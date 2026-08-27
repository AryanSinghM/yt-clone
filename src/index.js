import dotenv from "dotenv"
dotenv.config({
    path: './.env'
})
import connectDB from "./db/index.js"
import app from "./app.js"
import dns from "dns"

dns.setServers([
    '1.1.1.1',
    '8.8.8.8'
])

connectDB()
.then(() => {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`server is running at ${process.env.PORT}`)
    })
})
.catch((error) => {
    console.log("mongodb connection failed !!!")
})
