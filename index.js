require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
const serviceAccount = require("./decrypter.js");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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
const announcementsCollection = db.collection("announcements");
const commentsCollection = db.collection("comments");
const reportsCollection = db.collection("reports");

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

        //? USERS FOR ADMIN - GET API
        //TODO: verify admin
        app.get("/users", verifyToken, async (req, res) => {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const search = req.query.search || "";

            const query = search
                ? {
                      $or: [
                          { name: { $regex: search, $options: "i" } },
                          { email: { $regex: search, $options: "i" } },
                      ],
                  }
                : {};

            try {
                const totalUsers = await usersCollection.countDocuments(query);
                const users = await usersCollection
                    .find(query)
                    .skip((page - 1) * limit)
                    .limit(limit)
                    .sort({ createdAt: -1 }) // Optional: newest users first
                    .toArray();

                res.status(200).json({
                    totalUsers,
                    totalPages: Math.ceil(totalUsers / limit),
                    currentPage: page,
                    users,
                });
            } catch (error) {
                res.status(500).json({ message: "Internal Server Error" });
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

        //? USER BADGE - PATCH API
        app.patch("/users/:uid/badges", verifyToken, async (req, res) => {
            const { uid } = req.params;
            const { badge } = req.body;

            if (!badge) {
                return res.status(400).json({ error: "Badge is required" });
            }

            try {
                const result = await usersCollection.updateOne(
                    { uid },
                    { $addToSet: { badges: badge } }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({ error: "User not found" });
                }

                res.send({ message: "Badge updated successfully", result });
            } catch (error) {
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        //? USER BADGE - PATCH API
        app.patch("/users/:id/make-admin", verifyToken, async (req, res) => {
            const { id } = req.params;

            if (!ObjectId.isValid(id)) {
                return res
                    .status(400)
                    .json({ error: "Invalid user ID format" });
            }

            try {
                const result = await usersCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { role: "admin" } }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({ error: "User not found" });
                }

                res.status(200).json({
                    message: "Role updated successfully",
                    modifiedCount: result.modifiedCount,
                    newRole: "admin",
                });
            } catch (error) {
                console.error("Error updating user role:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        //?POST ALL - GET API
        app.get("/posts", async (req, res) => {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 5;
            const sortByPopularity = req.query.sortByPopularity === "true";
            const tag = req.query.tag;

            const skip = (page - 1) * limit;

            let sortOption = { createdAt: -1 }; // default: latest first

            if (sortByPopularity) {
                sortOption = { popularity: -1, createdAt: -1 }; // secondary sort by time
            }

            // Build match query
            let match = {};
            if (tag) {
                match.tag = { $regex: new RegExp(`^${tag}$`, "i") }; // case-insensitive exact tag
            }

            try {
                const pipeline = [
                    { $match: match },
                    {
                        $addFields: {
                            popularity: {
                                $subtract: [
                                    { $size: "$upvote" },
                                    { $size: "$downvote" },
                                ],
                            },
                        },
                    },
                    {
                        $sort: sortOption,
                    },
                    {
                        $skip: skip,
                    },
                    {
                        $limit: limit,
                    },
                ];

                const posts = await postsCollection
                    .aggregate(pipeline)
                    .toArray();

                const total = await postsCollection.countDocuments();

                res.status(200).json({
                    posts,
                    total,
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                });
            } catch (error) {
                res.status(500).json({
                    message: "Internal Server Error",
                    error,
                });
            }
        });

        //?POST by specific basic user - GET API
        app.get(
            "/posts/basic-user/:authorId",
            verifyToken,
            async (req, res) => {
                const authorId = req.params.authorId || "";
                if (!authorId) {
                    return res.status(400).json({
                        message: "Author id not found",
                    });
                }
                try {
                    const post = await postsCollection
                        .find({ authorId: new ObjectId(authorId) })
                        .toArray();

                    res.status(200).json(post);
                } catch {
                    res.status(500).json({ message: "Internal Server Error" });
                }
            }
        );

        //?POST by Post ID - GET API
        app.get("/post/:id", async (req, res) => {
            const postId = req.params.id || "";
            // Validate required fields
            if (!postId) {
                return res.status(400).json({
                    message: "Post id not found",
                });
            }
            try {
                const post = await postsCollection
                    .find({ _id: new ObjectId(postId) })
                    .toArray();

                res.status(200).json(post);
            } catch {
                res.status(500).json({ message: "Internal Server Error" });
            }
        });

        //?POST by Specific User for dashboard - GET API
        app.get("/posts/user/:authorId", verifyToken, async (req, res) => {
            const authorId = req.params.authorId;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;

            try {
                // Get paginated posts
                const posts = await postsCollection
                    .find({ authorId: new ObjectId(authorId) })
                    .sort({ createdAt: -1 }) // Latest first
                    .skip(skip)
                    .limit(limit)
                    .toArray();

                // Get total count for pagination info
                const totalPosts = await postsCollection.countDocuments({
                    authorId: new ObjectId(authorId),
                });

                const totalPages = Math.ceil(totalPosts / limit);

                res.status(200).json({
                    posts,
                    pagination: {
                        currentPage: page,
                        totalPages,
                        totalPosts,
                        hasNextPage: page < totalPages,
                        hasPrevPage: page > 1,
                    },
                });
            } catch (error) {
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
                    upvote: [],
                    downvote: [],
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

        //?POST VOTING - PATCH API
        app.patch("/posts/:postId/vote", verifyToken, async (req, res) => {
            const { postId } = req.params;
            const { type, email } = req.body;

            if (
                !["upvote", "downvote", "-upvote", "-downvote"].includes(
                    type
                ) &&
                !email
            ) {
                return res
                    .status(400)
                    .json({ message: "Invalid vote type or email" });
            }

            try {
                const filter = { _id: new ObjectId(postId) };
                let update = {};
                if (type === "-upvote") {
                    update = {
                        $pull: { upvote: email },
                    };
                } else if (type === "-downvote") {
                    update = {
                        $pull: { downvote: email },
                    };
                } else {
                    update =
                        type === "upvote"
                            ? {
                                  $addToSet: { upvote: email },
                                  $pull: { downvote: email },
                              }
                            : {
                                  $addToSet: { downvote: email },
                                  $pull: { upvote: email },
                              };
                }

                const result = await postsCollection.updateOne(filter, update);

                if (result.modifiedCount === 0) {
                    return res.status(404).json({ message: "Post not found." });
                }

                res.status(200).json({ message: `${type} count updated.` });
            } catch (error) {
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
        //TODO: verify admin
        app.post("/tags", verifyToken, async (req, res) => {
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

        // ?COMMENTS - GET API
        app.get("/comments/:postId", async (req, res) => {
            try {
                const { postId } = req.params;

                if (!postId) {
                    return res
                        .status(400)
                        .json({ message: "Post ID is required." });
                }

                const comments = await commentsCollection
                    .find({ postId: new ObjectId(postId) })
                    .sort({ createdAt: -1 }) // newest first
                    .toArray();

                res.status(200).json(comments);
            } catch (error) {
                res.status(500).json({ message: "Failed to fetch comments." });
            }
        });

        //?COMMENTS For dashboard - GET API
        app.get("/comments/post/:postId", verifyToken, async (req, res) => {
            const { postId } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;

            try {
                const query = { postId: new ObjectId(postId) };

                const totalCount = await commentsCollection.countDocuments(
                    query
                );
                const totalPages = Math.ceil(totalCount / limit);

                const comments = await commentsCollection
                    .find(query)
                    .sort({ createdAt: -1 }) // Newest first
                    .skip(skip)
                    .limit(limit)
                    .toArray();

                res.status(200).json({
                    comments,
                    currentPage: page,
                    totalPages,
                    totalCount,
                });
            } catch (error) {
                res.status(500).json({ message: "Internal server error." });
            }
        });

        // ?COMMENTS - POST API
        app.post("/comments", verifyToken, async (req, res) => {
            try {
                const { postId, authorId, authorName, authorImage, content } =
                    req.body;
                // Basic validation
                if (
                    !postId ||
                    !authorId ||
                    !authorName ||
                    !authorImage ||
                    !content
                ) {
                    return res
                        .status(400)
                        .json({ message: "Missing required fields." });
                }
                const newComment = {
                    postId: new ObjectId(postId),
                    authorId: new ObjectId(authorId),
                    authorName,
                    authorImage,
                    content,
                    upvotes: [],
                    downvotes: [],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };

                const result = await commentsCollection.insertOne(newComment);
                res.status(201).json({
                    message: "Comment added successfully",
                    insertedId: result.insertedId,
                });
            } catch (error) {
                res.status(500).json({ message: "Failed to add comment" });
            }
        });

        // ?COMMENTS - DELETE API
        //TODO: verify admin
        app.delete("/comments/:id", verifyToken, async (req, res) => {
            const { id } = req.params;

            try {
                const result = await commentsCollection.deleteOne({
                    _id: new ObjectId(id),
                });

                if (result.deletedCount === 0) {
                    return res
                        .status(404)
                        .json({ message: "Comment not found." });
                }

                res.status(200).json({
                    message: "Comment deleted successfully.",
                });
            } catch (error) {
                console.error("Error deleting comment:", error);
                res.status(500).json({ message: "Failed to delete comment." });
            }
        });

        //? REPORTS - GET API
        //TODO: verify admin
        app.get("/reports", verifyToken, async (req, res) => {
            try {
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 10;
                const status = req.query.status;

                const query = {};
                if (status && status !== "all") {
                    query.status = status;
                }

                const skip = (page - 1) * limit;

                const [totalReports, reports] = await Promise.all([
                    reportsCollection.countDocuments(query),
                    reportsCollection
                        .find(query)
                        .sort({ createdAt: -1 }) // Newest first
                        .skip(skip)
                        .limit(limit)
                        .toArray(),
                ]);

                res.status(200).json({
                    totalReports,
                    totalPages: Math.ceil(totalReports / limit),
                    currentPage: page,
                    reports,
                });
            } catch (error) {
                console.error("Failed to fetch reports:", error);
                res.status(500).json({ message: "Internal Server Error" });
            }
        });

        //? REPORTS (comment) - POST API
        app.post("/reports/comment", verifyToken, async (req, res) => {
            const { commentId, postId, reportedBy, reason, commentContent } =
                req.body;

            // Basic validation
            if (
                !commentId ||
                !postId ||
                !reportedBy ||
                !reason ||
                !commentContent
            ) {
                return res
                    .status(400)
                    .json({ message: "Missing required fields." });
            }

            try {
                const report = {
                    reportType: "comment",
                    commentId: new ObjectId(commentId),
                    postId: new ObjectId(postId),
                    reportedBy,
                    reason,
                    commentContent,
                    status: "pending",
                    createdAt: new Date(),
                };

                const result = await reportsCollection.insertOne(report);

                res.status(201).json({
                    message: "Comment reported successfully.",
                    reportId: result.insertedId,
                });
            } catch (error) {
                res.status(500).json({ message: "Internal Server Error" });
            }
        });

        //? REPORTS status - PATCH API
        //TODO: verify admin
        app.patch("/reports/:id/status", verifyToken, async (req, res) => {
            const { id } = req.params;
            const { status } = req.body;

            // Validate the incoming status
            const validStatuses = ["pending", "resolved", "dismissed"];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ error: "Invalid status value." });
            }

            try {
                const result = await reportsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            status,
                            updatedAt: new Date(),
                        },
                    }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({ error: "Report not found." });
                }

                res.status(200).json({
                    message: "Report status updated successfully.",
                    result,
                });
            } catch (error) {
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        //? REPORTS - DELETE API
        //TODO: verify admin
        app.delete("/reports/:id/delete", verifyToken, async (req, res) => {
            const { id } = req.params;

            try {
                const result = await reportsCollection.deleteOne({
                    _id: new ObjectId(id),
                });

                if (result.deletedCount === 0) {
                    return res.status(404).json({ error: "Report not found" });
                }

                res.status(200).json({
                    message: "Report deleted successfully",
                    result,
                });
            } catch (error) {
                console.error("Error deleting report:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        // ?ADMIN ANNOUNCEMENTS - GET API
        app.get("/announcements", async (req, res) => {
            try {
                const announcements = await announcementsCollection
                    .find({})
                    .sort({ pinned: -1, createdAt: -1 }) // Pinned first, then latest
                    .toArray();

                res.status(200).json(announcements);
            } catch (error) {
                res.status(500).json({ message: "Internal Server Error" });
            }
        });

        // ?ADMIN ANNOUNCEMENTS - POST API
        //TODO: verify admin
        app.post("/announcements", verifyToken, async (req, res) => {
            const {
                title,
                message,
                audience = "all",
                pinned = false,
                authorId,
                authorName,
                authorEmail,
                authorImage,
            } = req.body;

            // Validate required fields
            if (!title || !message || !authorId || !authorName) {
                return res.status(400).json({
                    message:
                        "Title, message, authorId, and authorName are required.",
                });
            }

            const newAnnouncement = {
                title,
                message,
                audience, // "all" | "users" | "admins" etc.
                pinned,
                createdAt: new Date(),
                authorId: new ObjectId(authorId),
                authorName,
                authorEmail,
                authorImage,
            };

            try {
                const result = await announcementsCollection.insertOne(
                    newAnnouncement
                );
                res.status(201).json({
                    message: "Announcement created successfully.",
                    insertedId: result.insertedId,
                });
            } catch (error) {
                res.status(500).json({ message: "Internal Server Error" });
            }
        });

        // ?ADMIN STATS - GET API
        //TODO:  verify admin
        app.get("/admin/stats", verifyToken, async (req, res) => {
            try {
                //* Count documents in each collection
                const totalUsers =
                    await usersCollection.estimatedDocumentCount();
                const totalPosts =
                    await postsCollection.estimatedDocumentCount();
                const totalComments =
                    await commentsCollection.estimatedDocumentCount();

                res.status(200).json({
                    totalUsers,
                    totalPosts,
                    totalComments,
                });
            } catch (error) {
                res.status(500).json({ message: "Internal server error" });
            }
        });

        //? Create PaymentIntent API
        app.post("/create-payment-intent", verifyToken, async (req, res) => {
            const { amount } = req.body; // amount in cents
            try {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount,
                    currency: "usd",
                });
                res.send({ clientSecret: paymentIntent.client_secret });
            } catch (error) {
                res.status(500).send({ error: error.message });
            }
        });
    } finally {
    }
}
run().catch(console.dir);

app.listen(port, () => {
    console.log("Nerds are talking at port,", port);
});
