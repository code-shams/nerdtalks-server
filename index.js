require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
const serviceAccount = require("./decrypter.js");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount()),
});

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
const verifyToken = (req, res, next) => {
    const token = req.headers?.authorization;
    if (!token || !token.startsWith("Bearer ")) {
        return res.status(401).send({ message: "Unauthorized Access Denied" });
    }
    const accessToken = token.split(" ")[1];
    admin
        .auth()
        .verifyIdToken(accessToken)
        .then((decoded) => {
            req.decoded = decoded;
            next();
        })
        .catch((err) => {
            res.status(403).send({ message: "Forbidden Access", error: err });
        });
};

app.get("/", (req, res) => {
    res.send(`Nerds are talking`);
});

const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

const db = client.db("nerdtalks");
const usersCollection = db.collection("users");
const postsCollection = db.collection("posts");
const tagsCollection = db.collection("tags");

async function run() {
    try {
        // ?USER - GET API
        app.get("/users/:uid", verifyToken, async (req, res) => {
            const { uid } = req.params;

            try {
                const user = await usersCollection.findOne({ uid });

                if (!user) {
                    return res.status(404).json({ message: "User not found." });
                }

                res.status(200).json(user);
            } catch (error) {
                console.error("Error fetching user:", error);
                res.status(500).json({ message: "Internal server error." });
            }
        });

        // ?USER - POST API
        app.post("/users", async (req, res) => {
            const { uid, name, email, avatar } = req.body;
            if (!uid || !name || !email) {
                return res
                    .status(400)
                    .json({ message: "uid, name, and email are required." });
            }

            try {
                // Prevent duplicate entries (check by uid or email)
                const existingUser = await usersCollection.findOne({ uid });
                if (existingUser) {
                    return res
                        .status(409)
                        .json({ message: "User already exists." });
                }
                const user = {
                    uid,
                    name,
                    email,
                    avatar: avatar || "",
                    role: "user",
                    badges: ["bronze"],
                    joinedAt: new Date(),
                };
                const result = await usersCollection.insertOne(user);
                res.status(201).json({
                    message: "User created successfully.",
                    userId: result.insertedId,
                });
            } catch {
                console.error("Error creating user:", error);
                res.status(500).json({ message: "Internal server error." });
            }
        });

        //?POST ALL - GET API
        app.get("/posts", async (req, res) => {
            const searchTerm = req?.query?.searchTerm;
            console.log(searchTerm);
            let query = {};

            if (searchTerm) {
                query = {
                    tag: { $regex: searchTerm, $options: "i" }, // Case-insensitive match
                };
            }
            try {
                const posts = await postsCollection
                    .find(query)
                    .sort({ createdAt: -1 }) // optional: latest first
                    .toArray();

                res.status(200).json(posts);
            } catch (error) {
                res.status(500).json({ message: "Internal Server Error" });
            }
        });

        //?POST by Specific User - GET API
        app.get("/posts/user/:authorId", verifyToken, async (req, res) => {
            const authorId = req.params.authorId;
            const limit = parseInt(req.query.limit) || 0;
            try {
                const posts = await postsCollection
                    .find({ authorId: new ObjectId(authorId) })
                    .sort({ createdAt: -1 }) // optional: latest first
                    .limit(limit)
                    .toArray();

                res.status(200).json(posts);
            } catch {
                res.status(500).json({ message: "Internal Server Error" });
            }
        });

        // ?POST CREATE - POST API
        app.post("/posts", verifyToken, async (req, res) => {
            const {
                title,
                content,
                tag,
                authorId,
                authorName,
                authorEmail,
                authorImage,
            } = req.body;

            // Basic validation
            if (
                !title ||
                !content ||
                !tag ||
                !authorId ||
                !authorName ||
                !authorImage ||
                !authorEmail
            ) {
                return res
                    .status(400)
                    .json({ message: "Missing required fields." });
            }

            try {
                const post = {
                    title,
                    content,
                    tag,
                    authorId: new ObjectId(authorId),
                    authorName,
                    authorEmail,
                    authorImage,
                    upvotes: 0,
                    downvotes: 0,
                    createdAt: new Date(),
                };

                const result = await postsCollection.insertOne(post);

                res.status(201).json({
                    message: "Post created successfully.",
                    postId: result.insertedId,
                });
            } catch (error) {
                console.error("Error creating post:", error);
                res.status(500).json({ message: "Internal server error." });
            }
        });

        //?POST - DELETE API
        app.delete("/posts/:id", verifyToken, async (req, res) => {
            const postId = req.params.id;

            try {
                const result = await postsCollection.deleteOne({
                    _id: new ObjectId(postId),
                });

                if (result.deletedCount === 0) {
                    return res.status(404).json({ message: "Post not found" });
                }

                res.status(200).json({ message: "Post deleted successfully" });
            } catch {
                res.status(500).json({ message: "Internal Server Error" });
            }
        });

        // ?TAGS - GET API
        app.get("/tags", async (req, res) => {
            try {
                const tags = await tagsCollection.find().toArray();
                res.status(200).json(tags);
            } catch (error) {
                res.status(500).json({ message: "Internal Server Error" });
            }
        });

        // ?TAGS - POST API
        app.post("/tags", async (req, res) => {
            try {
                const { name, description, icon } = req.body;

                if (!name || !description || !icon) {
                    return res
                        .status(400)
                        .json({ message: "All fields are required" });
                }

                const newTag = {
                    name,
                    description,
                    icon,
                    usageCount: 0,
                    createdAt: new Date(),
                };

                const result = await tagsCollection.insertOne(newTag);
                res.status(201).json({
                    message: "Tag added successfully",
                    id: result.insertedId,
                });
            } catch (error) {
                res.status(500).json({ message: "Internal Server Error" });
            }
        });
    } finally {
    }
}
run().catch(console.dir);

app.listen(port, () => {
    console.log("Nerds are talking at port,", port);
});
