const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 4000;

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hbpicg2.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const usersCollection = client.db("lensMasterDb").collection("users");
    const coursesCollection = client.db("lensMasterDb").collection("courses");
    const cartCollection = client.db("lensMasterDb").collection("carts");
    const paymentCollection = client.db("lensMasterDb").collection("payments");

    // user API
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "user already exists" });
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "admin",
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "instructor",
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Courses API
    app.get("/courses", async (req, res) => {
      const result = await coursesCollection.find().toArray();
      res.send(result);
    });
    app.get("/courses/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await coursesCollection.findOne(query);
      res.send(result);
    });

    app.post("/courses", async (req, res) => {
      const courses = req.body;
      const result = await coursesCollection.insertOne(courses);
      res.send(result);
    });
    app.put("/updateCourse/:id", async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          name: body.name,
          photoURL: body.photoURL,
          seats: body.seats,
          price: body.price,
        },
      };
      const result = await coursesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch("/courses/approve/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "Approved",
        },
      };

      const result = await coursesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.patch("/courses/feedback/:id", async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          feedback: body.feedback,
        },
      };

      const result = await coursesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.patch("/courses/deny/:id", async (req, res) => {
      const id = req.params.id;

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "Deny",
        },
      };

      const result = await coursesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // carts api

    app.get("/carts", async (req, res) => {
      const result = await cartCollection.find().toArray();
      res.send(result);
    });
    app.get("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.findOne(query);
      res.send(result);
    });

    app.get("/carts/email/:email", async (req, res) => {
      const result = await cartCollection
        .find({ email: req.params.email })
        .toArray();
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      const course = req.body;
      const result = await cartCollection.insertOne(course);
      res.send(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // create payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;

      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    //payment related api
    app.get("/paymentHistory/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await paymentCollection
        .find(query)
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);

      const query = {
        _id: { $in: payment.cartItems.map((id) => new ObjectId(id)) },
      };
      const deleteResult = await cartCollection.deleteMany(query);
      const filter = { _id: new ObjectId(payment.classId) };

      // Find the document in the sportsClass collection
      const sportsClass = await coursesCollection.findOne(filter);

      // Update the available seat count
      sportsClass.seats = sportsClass.seats - 1;
      sportsClass.enroll = sportsClass.enroll + 1;

      const updateResult = await coursesCollection.updateOne(filter, {
        $set: sportsClass,
      });
      // Update the enrolled student count
      // sportsClass.students = sportsClass.students + 1;
      // const updateStudents = await sportsClassCollection.updateOne(filter, { $set: sportsClass });

      res.send({ insertResult, deleteResult, updateResult });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Lens Master is Capturing");
});

app.listen(port, () => {
  console.log(`Master is running on port ${port}`);
});
