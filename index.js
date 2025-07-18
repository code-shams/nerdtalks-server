require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
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

async function run() {
    try {
        //* Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log(
            "Pinged your deployment. You successfully connected to MongoDB!"
        );

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
    } finally {
    }
}
run().catch(console.dir);

app.listen(port, () => {
    console.log("Nerds are talking at port,", port);
});
