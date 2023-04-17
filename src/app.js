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

    const message = { from: from, to: to, text: text, type: type, time: dayjs().format('HH:mm:ss') }

    const messageSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid('message', 'private_message'),
        from: joi.string().required(),
        time: joi.string().required()
    })

    const validation = messageSchema.validate(message, { abortEarly: false })

    if (validation.error) {
        return res.sendStatus(422)
    }

    try {
        await db.collection("messages").insertOne(message)
        res.sendStatus(201)
    } catch (err) {
        res.status(500).send(err.message)
    }

})

app.get("/messages", async (req, res) => {
    const from = req.headers.user

    try {
        const messages = await db.collection("messages").find({ $or: [{ to: "Todos" }, { to: from }, { from: from }] }).toArray()

        const limit = req.query.limit

        if (limit) {
            const limitSchema = joi.number().integer().min(1)
            const validation = limitSchema.validate(limit, { abortEarly: false })
            if (validation.error) {
                return res.sendStatus(422)
            }
            const newMessages = messages.slice(-limit)
            return res.send(newMessages)
        }
        res.send(messages)
    } catch (err) {
        res.status(500).send(err.message)
    }
})

app.post("/status", async (req, res) => {
    const user = req.headers.user

    if (!user) {
        return res.sendStatus(404)
    }

    try {
        const participant = await db.collection("participants").findOne({ name: user })
        if (!participant) {
            return res.sendStatus(404)
        }
        await db.collection("participants").updateOne({ name: user }, { $set: { name: user, lastStatus: Date.now() } })
        res.sendStatus(200)
    } catch (err) {
        res.status(500).send(err.message)
    }

})

async function lastStatus(){
    try{
        const participants = await db.collection("participants").find().toArray()
        participants.forEach( async (participant) => {
            const lastStatus = (participant.lastStatus)/1000
            const time = (Date.now())/1000
            if(time-lastStatus>10){
                await db.collection("participants").deleteOne({name:participant.name})
                await db.collection("messages").insertOne({ 
                    from: participant.name,
                    to: 'Todos',
                    text: 'sai da sala...',
                    type: 'status',
                    time: dayjs().format('HH:mm:ss')
                })
            }
        })
    }catch(err){
        res.status(500).send(err.message)
    }
}

setInterval(lastStatus,15000)

app.listen(5000)