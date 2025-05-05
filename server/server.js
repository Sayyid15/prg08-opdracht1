import { AzureChatOpenAI, AzureOpenAIEmbeddings } from "@langchain/openai";
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Models
const model = new AzureChatOpenAI({
    azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
    azureOpenAIApiVersion: process.env.OPENAI_API_VERSION,
    azureOpenAIApiInstanceName: process.env.INSTANCE_NAME,
    azureOpenAIApiDeploymentName: process.env.ENGINE_NAME,
});

const embedding = new AzureOpenAIEmbeddings({
    temperature:0,
    azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME
});

// Load the vectorstore
let vectorStore;
async function loadVectorStore() {
    vectorStore = await FaissStore.load("swimmerStoryDb", embedding);
    console.log("Vector store loaded!");
}
await loadVectorStore();

// State variables
let swimmerTrainings = [];
let poolName = '';
let currentWeather = '';

// Date formatting
const today = new Date();
const year = today.getFullYear();
let month = today.getMonth() + 1;
let day = today.getDate();
if (day < 10) day = '0' + day;
if (month < 10) month = '0' + month;
const date = `${day}/${month}/${year}`;

// Weather fetcher
async function getWeather(poolName) {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${poolName}&appid=${apiKey}&units=metric`);
    const data = await response.json();
    if (data.weather && data.weather.length > 0) {
        return `Current weather in ${poolName}: ${data.weather[0].description}, temperature ${data.main.temp}°C`;
    } else {
        return "Weather information not available.";
    }
}

// Routes
app.get("/", (req, res) => {
    res.send("Welcome to the Swimmer Training API!");
});

// Set location and weather
app.post("/location", async (req, res) => {
    const { pool } = req.body;
    if (!pool) return res.status(400).json({ error: 'Pool name is required' });

    try {
        poolName = pool;
        currentWeather = await getWeather(poolName);
        console.log(currentWeather);
        res.status(200).json({ message: "Location and weather set", weather: currentWeather });
    } catch (error) {
        console.error("Error setting location:", error);
        res.status(500).json({ error: "Error setting location" });
    }
});

// Generate swimmer summary
async function swimmerSummary(swimmerTraining) {
    if (!swimmerTraining) throw new Error('Swimmer entry is required');

    const relevantDocs = await vectorStore.similaritySearch(swimmerTraining, 3);
    const context = relevantDocs.map(doc => doc.pageContent).join("\n\n");

    const messages = [
        new SystemMessage(
            `You are a swimming trainer assistant. Summarize swimmer performances warmly and professionally.\n
Today's date: ${date}.\n
Location: ${poolName}.\n
Use this past context if relevant:\n${context}`
        ),
        new HumanMessage(`Summarize the following swimmer performance:\n${swimmerTraining}`)
    ];

    const response = await model.invoke(messages);
    return response.content;
}

// Chat endpoint
app.post("/chat", async (req, res) => {
    try {
        const { query: swimmerTraining } = req.body;
        if (!swimmerTraining) {
            return res.status(400).json({ error: 'Swimmer entry is required' });
        }

        const response = await swimmerSummary(swimmerTraining);

        swimmerTrainings.push(swimmerTraining);
        if (swimmerTrainings.length > 10) swimmerTrainings.shift(); // Keep last 10

        res.json({ response });
    } catch (error) {
        console.error("Error in chat:", error);
        res.status(500).json({ error: "Error generating swimmer summary" });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
