require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// ==========================================================
//    MIDDLEWARE (OPEN FOR ALL)
// ==========================================================
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// MongoDB URI
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
    // Connect the client to the server
    // await client.connect();

    const database = client.db("educareHubDB");
    const courseCollection = database.collection("courses");
    const enrollmentCollection = database.collection("enrollments");
    const userCollection = database.collection("users");

    // ==========================================================
    //    BYPASSED MIDDLEWARE (No Token Check)
    // ==========================================================
    const verifyToken = (req, res, next) => {
      // সরাসরি যাওয়ার অনুমতি দেওয়া হলো
      next();
    };

    // ==========================================================
    //    AUTH ROUTES (Dummy for Frontend Compatibility)
    // ==========================================================
    
    app.post("/jwt", (req, res) => {
      res.send({ success: true, token: "dummy-token" });
    });

    app.post("/logout", (req, res) => {
      res.send({ success: true });
    });

    // ==========================================================
    //    USER ROUTES
    // ==========================================================

    // Save User
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // Get User Role & Info
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      res.send(user);
    });

    // Get All Users (Admin)
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // Update User Role
    app.patch("/users/role/:id", async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: { role: role },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // ==========================================================
    //    COURSE ROUTES
    // ==========================================================

    // GET All Courses (Filter, Search, Sort, Pagination)
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

      if (category && category !== "All") {
        query.category = category;
      }
      if (isFeatured) {
        query.isFeatured = true;
      }

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

    // GET Total Count (For Pagination)
    app.get("/courses-count", async (req, res) => {
      const search = req.query.search || "";
      const category = req.query.category || "";

      let query = {
        title: { $regex: search, $options: "i" },
      };
      if (category && category !== "All") {
        query.category = category;
      }
      
      const count = await courseCollection.countDocuments(query);
      res.send({ count });
    });

    // GET Single Course
    app.get("/courses/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await courseCollection.findOne(query);
      res.send(result);
    });

    // GET My Added Courses (Instructor)
    app.get("/my-courses/:email", async (req, res) => {
      const email = req.params.email;
      const query = { instructorEmail: email };
      const result = await courseCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    // POST New Course
    app.post("/courses", async (req, res) => {
      const courseData = req.body;
      courseData.createdAt = new Date();
      const result = await courseCollection.insertOne(courseData);
      res.send(result);
    });

    // UPDATE Course
    app.put("/courses/:id", async (req, res) => {
      const id = req.params.id;
      const courseData = req.body;
      const filter = { _id: new ObjectId(id) };
      
      // Remove _id from data to avoid immutable field error
      const { _id, ...updateFields } = courseData;

      const updateDoc = {
        $set: updateFields,
      };
      const result = await courseCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // DELETE Course (Cascading delete enrollments)
    app.delete("/courses/:id", async (req, res) => {
      const id = req.params.id;
      const courseQuery = { _id: new ObjectId(id) };
      const enrollmentQuery = { courseId: id };

      const deleteCourseResult = await courseCollection.deleteOne(courseQuery);
      const deleteEnrollmentsResult = await enrollmentCollection.deleteMany(enrollmentQuery);

      res.send({
        courseDeleteInfo: deleteCourseResult,
        enrollmentDeleteInfo: deleteEnrollmentsResult,
      });
    });

    // ==========================================================
    //    ENROLLMENT ROUTES
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
      const result = await enrollmentCollection
        .find(query)
        .sort({ enrollmentDate: -1 })
        .toArray();
      res.send(result);
    });

    // ==========================================================
    //    ROOT ROUTE
    // ==========================================================
    app.get("/", (req, res) => {
      res.send("EducareHub Server is running...");
    });

    app.listen(port, () => {
      console.log(`EducareHub Server is running on port ${port}`);
    });
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);