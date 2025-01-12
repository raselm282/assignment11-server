const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const cookieParser = require("cookie-parser");
const jwt = require('jsonwebtoken')
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const corsOptions = {
  origin: ["http://localhost:5173","https://assignment11-clients.web.app"

  ],
  credentials: true,
  optionalSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yz4tz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
// verifyToken
const verifyToken = (req,res,next)=>{
  // console.log('iam middleware');
  const token = req.cookies?.token
  if(!token) return res.status(401).send({message: 'unauthorize access'})
    jwt.verify(token,process.env.SECRET_KEY,(err,decoded)=>{
  if(err){
    return res.status(401).send({message: 'unauthorize access'})
  }
  req.user = decoded
  })
  // console.log(token);
  next()
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const marathonsCollection = client.db("myMarathon").collection("marathon");
    const myMarathonsCollection = client
      .db("myMarathon")
      .collection("myApplyMarathon");

      //generate jwt
      app.post('/jwt',async(req,res)=>{
        const email = req.body
        //create token
        const token = jwt.sign(email, process.env.SECRET_KEY,{expiresIn:'365d'})
        // console.log(token);
        res.cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        }).send({ success: true })
      })

      // logout || clear cookie
      app.get('/logout',async(req,res)=>{
        res.clearCookie('token',{
          maxAge: 0,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        }).send({ success: true })
      })

      // save a jobData in db
    app.put("/updateMyApply/:id", async (req, res) => {
      const id = req.params.id;
      const maraData = req.body;
      const updated = {
        $set: maraData,
      };
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const result = await myMarathonsCollection.updateOne(
        query,
        updated,
        options
      );
      // console.log(result);
      res.send(result);
    });

    // delete a job from db
    app.delete("/myApplyDel/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await myMarathonsCollection.deleteOne(query);
      res.send(result);
    });
    // get a single job data by id from db
    app.get("/myApply/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await myMarathonsCollection.findOne(query);
      res.send(result);
    });
    // get all bids for a specific user
    // app.get("/bids/:email", verifyToken, async (req, res) => {
    app.get("/myApplyList/:email",verifyToken, async (req, res) => {
      const decodedEmail = req.user?.email
      // const isBuyer = req.query.buyer;
      const email = req.params.email;
      // console.log('email from token-->',decodedEmail);
      // console.log('email from params-->',email);
      const search = req.query.search
      if(decodedEmail !== email) return res.status(401).send({message: 'unauthorize access'})
      let query = {
        title: {
          $regex: search,
          $options: 'i',
        },
      }
      if (email) query.email = email
      
      const result = await myMarathonsCollection.find(query).toArray();
      res.send(result);
    });
    // save a bid data in db
    app.post("/addMarathon", async (req, res) => {
      const maraData = req.body;
      // 0. if a user placed a bid already in this job
      const query = { email: maraData.email, marathonId: maraData.marathonId };
      const alreadyExist = await myMarathonsCollection.findOne(query);
      // console.log("If already exist-->", alreadyExist);
      if (alreadyExist)
        return res
          .status(400)
          .send("You have already placed a bid on this job!");
      // 1. Save data in bids collection

      const result = await myMarathonsCollection.insertOne(maraData);

      // 2. Increase bid count in jobs collection
      const filter = { _id: new ObjectId(maraData.marathonId) };
      const update = {
        $inc: { mara_count: 1 },
      };
      const updateMaraCount = await marathonsCollection.updateOne(
        filter,
        update
      );
      // console.log(updateMaraCount);
      res.send(result);
    });
    // --------------------------
    //save mara data in db
    app.post("/add-mara", async (req, res) => {
      const maraData = req.body;
      const result = await marathonsCollection.insertOne(maraData);
      // console.log(result);
      res.send(result);
    });
    //gat all mara data from db
    app.get("/add-mara", async (req, res) => {
      const sort = req.query.sort
      let options = {}
      if (sort) options = { sort: { createdAt: sort === 'asc' ? 1 : -1 } }
      const result = await marathonsCollection.find(options).toArray();
      res.send(result);
    });
    //gat all mara data from db for home limit
    app.get("/marathonForHome", async (req, res) => {
      const result = await marathonsCollection.find().limit(6).toArray();
      res.send(result);
    });
    //gat all mara data from db for upcoming section of home
    app.get("/upcomingMarathonForHome", async (req, res) => {
     const result = await marathonsCollection.find().toArray();
      res.send(result);
    });
    // get a single job data by id from db
    app.get("/add-mara/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await marathonsCollection.findOne(query);
      res.send(result);
    });
    //get all mara posted by specific user
    app.get("/marathons/:email", async (req, res) => {
      const email = req.params.email;
      const query = { "buyer.email": email };
      const result = await marathonsCollection.find(query).toArray();
      res.send(result);
    });
    // delete a job from db
    app.delete("/marathon/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await marathonsCollection.deleteOne(query);
      res.send(result);
    });
    // save a jobData in db
    app.put("/update-job/:id", async (req, res) => {
      const id = req.params.id;
      const jobData = req.body;
      const updated = {
        $set: jobData,
      };
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const result = await marathonsCollection.updateOne(
        query,
        updated,
        options
      );
      // console.log(result);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("my assignments 11 is running");
});
app.listen(port, () => {
  console.log(`my assign-11 port is running on ${port}`);
});
