require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://educarehub-5b51c.web.app",
    "https://educarehub-5b51c.firebaseapp.com"
  ],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// MongoDB Configuration
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@z4tech.as3lfup.mongodb.net/?appName=Z4Tech`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Helper Function to Connect DB inside Routes
async function getCollection(collectionName) {
  await client.connect();
  return client.db("educareHubDB").collection(collectionName);
}

// ==========================================================
//    ROUTES (DEFINED GLOBALLY - NO WAITING)
// ==========================================================

// Root Route (Check this first)
app.get("/", (req, res) => {
  res.send("Server is Ready! Routes are loaded.");
});

// Auth Routes (Dummy)
app.post("/jwt", (req, res) => {
  res.send({ success: true });
});
app.post("/logout", (req, res) => {
  res.send({ success: true });
});

// --- USERS ---
app.get("/users", async (req, res) => {
  try {
    const usersCollection = await getCollection("users");
    const result = await usersCollection.find().toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "DB Connection Error", error: error.message });
  }
});

app.get("/users/:email", async (req, res) => {
  try {
    const usersCollection = await getCollection("users");
    const result = await usersCollection.findOne({ email: req.params.email });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "DB Error" });
  }
});

app.post("/users", async (req, res) => {
  try {
    const usersCollection = await getCollection("users");
    const user = req.body;
    const existing = await usersCollection.findOne({ email: user.email });
    if (existing) return res.send({ message: "User exists" });
    const result = await usersCollection.insertOne(user);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "DB Error" });
  }
});

app.patch("/users/role/:id", async (req, res) => {
  try {
    const usersCollection = await getCollection("users");
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { role: req.body.role } }
    );
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "DB Error" });
  }
});

// --- COURSES ---
app.get("/courses", async (req, res) => {
  try {
    const courseCollection = await getCollection("courses");
    // Simple fetch for testing
    const result = await courseCollection.find().toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "DB Error", error: error.message });
  }
});

app.get("/courses/:id", async (req, res) => {
  try {
    const courseCollection = await getCollection("courses");
    const result = await courseCollection.findOne({ _id: new ObjectId(req.params.id) });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "DB Error" });
  }
});

app.post("/courses", async (req, res) => {
  try {
    const courseCollection = await getCollection("courses");
    const result = await courseCollection.insertOne(req.body);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "DB Error" });
  }
});

app.put("/courses/:id", async (req, res) => {
  try {
    const courseCollection = await getCollection("courses");
    const { _id, ...rest } = req.body;
    const result = await courseCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: rest }
    );
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "DB Error" });
  }
});

app.delete("/courses/:id", async (req, res) => {
  try {
    const courseCollection = await getCollection("courses");
    const enrollmentCollection = await getCollection("enrollments");
    
    await enrollmentCollection.deleteMany({ courseId: req.params.id });
    const result = await courseCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "DB Error" });
  }
});

app.get("/my-courses/:email", async (req, res) => {
  try {
    const courseCollection = await getCollection("courses");
    const result = await courseCollection.find({ instructorEmail: req.params.email }).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "DB Error" });
  }
});

// --- ENROLLMENTS ---
app.post("/enrollments", async (req, res) => {
  try {
    const enrollmentCollection = await getCollection("enrollments");
    const result = await enrollmentCollection.insertOne({
      ...req.body,
      enrollmentDate: new Date()
    });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "DB Error" });
  }
});

app.get("/my-enrollments/:email", async (req, res) => {
  try {
    const enrollmentCollection = await getCollection("enrollments");
    const result = await enrollmentCollection.find({ studentEmail: req.params.email }).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "DB Error" });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = app;