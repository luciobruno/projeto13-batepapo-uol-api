import { MongoClient, ObjectId } from "mongodb";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";

const app = express()
app.use(cors())
app.use(express.json())
dotenv.config()

const mongoClient = new MongoClient(process.env.DATABASE_URL)
try {
    await mongoClient.connect()
    console.log("MongoDB conectado!")
} catch (err) {
    console.log(err.message)
}
const db = mongoClient.db()

app.post("/participants", async (req, res) => {

    const { name } = req.body

    const participantsSchema = joi.object({
        name: joi.string().required()
    })
    const validation = participantsSchema.validate(req.body, { abortEarly: false })

    if (validation.error) {
        return res.sendStatus(422)
    }

    try {   
        const participant = await db.collection("participants").findOne(req.body)
        if (participant) {
            return res.sendStatus(409)
        }
        await db.collection("participants").insertOne({ name: name, lastStatus: Date.now() })

        await db.collection("messages").insertOne({
            from: name,
            to: "Todos",
            text: "entra na sala...",
            type: "status",
            time: dayjs().format('HH:mm:ss')
        })
        res.sendStatus(201)
    } catch (err) {
        res.status(500).send(err.message)
    }
})

app.get("/participants", async (req, res) => {
    try {
        const participants = await db.collection("participants").find().toArray()
        res.send(participants)
    } catch (err) {
        res.status(500).send(err.message)
    }
})

app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body
    const from = req.headers.user

    try {
        const testFrom = await db.collection("participants").findOne({ name: from })
        if (!testFrom) {
            return res.sendStatus(422)
        }
    } catch (err) {
        res.status(500).send(err.message)
    }

    const message = { from: from ,to: to, text: text, type: type, time: dayjs().format('HH:mm:ss') }

    const messageSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid('message', 'private_message'),
        from: joi.string().required(),
        time: joi.string().required()
    })

    const validation = messageSchema.validate(message, { abortEarly: false })

    if (validation.error){
        return res.sendStatus(422)
    }

    try{
        await db.collection("messages").insertOne(message)
        res.sendStatus(201)
    }catch(err){
        res.status(500).send(err.message)
    }

})

app.listen(5000)