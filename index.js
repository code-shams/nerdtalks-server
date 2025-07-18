require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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

        // ?user creation POST API
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
