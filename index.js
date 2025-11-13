require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection URI
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
    // --- Database Collections ---
    const database = client.db("educareHubDB");
    const courseCollection = database.collection("courses");
    const enrollmentCollection = database.collection("enrollments");
    const userCollection = database.collection("users");

    // --- User Endpoints ---
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

    // --- Course Endpoints ---
    // GET all courses with optional filtering
    app.get("/courses", async (req, res) => {
      let query = {};

      if (req.query.category) {
        query.category = req.query.category;
      }

      const isFeatured = req.query.featured === "true";

      if (isFeatured) {
        query.isFeatured = true;
      }

      // Apply .limit(6) only if the 'featured' query parameter is true
      const cursor = courseCollection.find(query).sort({ createdAt: -1 });
      if (isFeatured) {
        cursor.limit(6);
      }
      const result = await cursor.toArray();
      res.send(result);
    });

    // GET a single course by its ID
    app.get("/courses/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await courseCollection.findOne(query);
      res.send(result);
    });

    // GET courses added by a specific instructor
    app.get("/my-courses/:email", async (req, res) => {
      const email = req.params.email;
      const query = { instructorEmail: email };
      const result = await courseCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    // POST a new course
    app.post("/courses", async (req, res) => {
      const courseData = req.body;
      courseData.createdAt = new Date();
      const result = await courseCollection.insertOne(courseData);
      res.send(result);
    });

    // PUT (Update) an existing course
    app.put("/courses/:id", async (req, res) => {
      const id = req.params.id;
      const courseData = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          title: courseData.title,
          imageUrl: courseData.imageUrl,
          price: courseData.price,
          duration: courseData.duration,
          category: courseData.category,
          description: courseData.description,
          isFeatured: courseData.isFeatured,
        },
      };
      const result = await courseCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // DELETE a course
    app.delete("/courses/:id", async (req, res) => {
      const id = req.params.id;

      // 1. Define queries for both collections
      const courseQuery = { _id: new ObjectId(id) };
      const enrollmentQuery = { courseId: id };

      // 2. Perform the delete operations
      const deleteCourseResult = await courseCollection.deleteOne(courseQuery);
      const deleteEnrollmentsResult = await enrollmentCollection.deleteMany(
        enrollmentQuery
      );

      // 3. Send back a combined result
      res.send({
        courseDeleteInfo: deleteCourseResult,
        enrollmentDeleteInfo: deleteEnrollmentsResult,
      });
    });

    // --- Enrollment Endpoints ---
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

    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );

    app.get("/", (req, res) => {
      res.send("EducareHub Server is running!");
    });

    app.listen(port, () => {
      console.log(`EducareHub Server is running on port ${port}`);
    });
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);
