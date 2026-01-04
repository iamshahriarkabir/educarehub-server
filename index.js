require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// ==========================================================
//    MIDDLEWARE (SIMPLE & OPEN)
// ==========================================================

// সব অরিজিন এবং মেথড অ্যালাউ করা হলো
app.use(cors()); 
app.use(express.json());

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@z4tech.as3lfup.mongodb.net/?appName=Z4Tech`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const database = client.db("educareHubDB");
    const courseCollection = database.collection("courses");
    const enrollmentCollection = database.collection("enrollments");
    const userCollection = database.collection("users");

    // ==========================================================
    //    DUMMY MIDDLEWARE (Token বাদ, সরাসরি এক্সেস)
    // ==========================================================
    const verifyToken = (req, res, next) => {
      // আমরা এখানে কোনো টোকেন চেক করছি না
      next();
    };

    // ==========================================================
    //    USER API
    // ==========================================================

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      res.send(user);
    });

    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.patch("/users/role/:id", async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = { $set: { role: role } };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // ==========================================================
    //    AUTH ROUTES (Just for Frontend Compatibility)
    // ==========================================================
    
    // ফ্রন্টএন্ড এরর এড়াতে ডামি রেসপন্স
    app.post("/jwt", (req, res) => {
      res.send({ success: true });
    });

    app.post("/logout", (req, res) => {
      res.send({ success: true });
    });

    // ==========================================================
    //    COURSE API
    // ==========================================================

    app.get("/courses", async (req, res) => {
      const page = parseInt(req.query.page) || 0;
      const size = parseInt(req.query.size) || 10;
      const search = req.query.search || "";
      const category = req.query.category || "";
      const sort = req.query.sort || "createdAt";
      const isFeatured = req.query.featured === "true";

      let query = {
        title: { $regex: search, $options: "i" },
      };

      if (category && category !== "All") query.category = category;
      if (isFeatured) query.isFeatured = true;

      let sortOptions = { createdAt: -1 };
      if (sort === "price-asc") sortOptions = { price: 1 };
      if (sort === "price-desc") sortOptions = { price: -1 };

      const cursor = courseCollection
        .find(query)
        .sort(sortOptions)
        .skip(page * size)
        .limit(size);

      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/courses-count", async (req, res) => {
      const search = req.query.search || "";
      const category = req.query.category || "";
      let query = { title: { $regex: search, $options: "i" } };
      if (category && category !== "All") query.category = category;
      const count = await courseCollection.countDocuments(query);
      res.send({ count });
    });

    app.get("/courses/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await courseCollection.findOne(query);
      res.send(result);
    });

    app.get("/my-courses/:email", async (req, res) => {
      const email = req.params.email;
      const query = { instructorEmail: email };
      const result = await courseCollection.find(query).sort({ createdAt: -1 }).toArray();
      res.send(result);
    });

    app.post("/courses", async (req, res) => {
      const courseData = req.body;
      courseData.createdAt = new Date();
      const result = await courseCollection.insertOne(courseData);
      res.send(result);
    });

    app.put("/courses/:id", async (req, res) => {
      const id = req.params.id;
      const courseData = req.body;
      const filter = { _id: new ObjectId(id) };
      const { _id, ...updatedData } = courseData;
      const result = await courseCollection.updateOne(filter, { $set: updatedData });
      res.send(result);
    });

    app.delete("/courses/:id", async (req, res) => {
      const id = req.params.id;
      const deleteCourseResult = await courseCollection.deleteOne({ _id: new ObjectId(id) });
      const deleteEnrollmentsResult = await enrollmentCollection.deleteMany({ courseId: id });
      res.send({ courseDeleteInfo: deleteCourseResult, enrollmentDeleteInfo: deleteEnrollmentsResult });
    });

    // ==========================================================
    //    ENROLLMENT API
    // ==========================================================

    app.post("/enrollments", async (req, res) => {
      const enrollmentData = req.body;
      enrollmentData.enrollmentDate = new Date();
      const result = await enrollmentCollection.insertOne(enrollmentData);
      res.send(result);
    });

    app.get("/my-enrollments/:email", async (req, res) => {
      const email = req.params.email;
      const query = { studentEmail: email };
      const result = await enrollmentCollection.find(query).sort({ enrollmentDate: -1 }).toArray();
      res.send(result);
    });

    app.get("/", (req, res) => {
      res.send("Server is running without restrictions!");
    });

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } finally {
    //
  }
}
run().catch(console.dir);