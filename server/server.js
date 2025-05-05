import { AzureChatOpenAI, AzureOpenAIEmbeddings } from "@langchain/openai";
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import multer from "multer";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import fs from "fs/promises";

const app = express();
const port = 3000;

// Configure file upload
const upload = multer({ dest: "uploads/" });

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
    temperature: 0,
    azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME
});

// Load the vectorstore
let vectorStore;
async function loadVectorStore() {
    try {
        vectorStore = await FaissStore.load("swimmerStoryDb", embedding);
        console.log("Vector store loaded!");
    } catch (error) {
        console.log("No existing vector store found, creating new one");
        vectorStore = await FaissStore.fromDocuments([], embedding);
    }
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

// Process uploaded document
async function processDocument(filePath) {
    try {
        const loader = new PDFLoader(filePath);
        const docs = await loader.load();

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });

        const splitDocs = await splitter.splitDocuments(docs);
        await vectorStore.addDocuments(splitDocs);

        // Save the updated vector store
        await vectorStore.save("swimmerStoryDb");

        return "Document processed and added to knowledge base!";
    } finally {
        // Clean up the uploaded file
        await fs.unlink(filePath).catch(console.error);
    }
}

// Routes
app.get("/", (req, res) => {
    res.send("Welcome to the Swimmer Training API!");
});

// Document upload endpoint
app.post("/upload", upload.single("document"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        // Check if the uploaded file is a PDF
        if (!req.file.mimetype.includes('pdf')) {
            await fs.unlink(req.file.path).catch(console.error);
            return res.status(400).json({ error: "Only PDF files are allowed" });
        }

        // Verify file was actually written to disk
        try {
            await fs.access(req.file.path);
        } catch (err) {
            return res.status(500).json({ error: "File upload failed - file not saved" });
        }

        const result = await processDocument(req.file.path);
        res.json({
            message: result,
            filename: req.file.originalname
        });
    } catch (error) {
        console.error("Error processing document:", error);

        // Clean up file if something went wrong
        if (req.file?.path) {
            await fs.unlink(req.file.path).catch(console.error);
        }

        res.status(500).json({
            error: "Error processing document",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
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

// Generate swimmer summary with RAG
async function swimmerSummary(swimmerTraining, chatHistory) {
    if (!swimmerTraining) throw new Error('Swimmer entry is required');

    // Search for relevant documents
    const relevantDocs = await vectorStore.similaritySearch(swimmerTraining, 3);
    const context = relevantDocs.map(doc => doc.pageContent).join("\n\n");

    // Prepare conversation history
    const history = chatHistory ? `Previous conversation:\n${chatHistory}\n\n` : '';

    const messages = [
        new SystemMessage(
            `You are a swimming trainer assistant. Summarize swimmer performances warmly and professionally.\n
Today's date: ${date}.\n
Location: ${poolName}.\n
${currentWeather ? `Weather: ${currentWeather}\n` : ''}
Use this knowledge base context if relevant:\n${context}\n
${history}`
        ),
        new HumanMessage(`Analyze and respond to:\n${swimmerTraining}`)
    ];

    const response = await model.invoke(messages);
    return {
        response: response.content,
        sources: relevantDocs.map(doc => ({
            pageContent: doc.pageContent,
            metadata: doc.metadata
        }))
    };
}

// Chat endpoint with RAG
app.post("/chat", async (req, res) => {
    try {
        const { query: swimmerTraining, context } = req.body;
        if (!swimmerTraining) {
            return res.status(400).json({ error: 'Swimmer entry is required' });
        }

        const { response, sources } = await swimmerSummary(swimmerTraining, context);

        swimmerTrainings.push(swimmerTraining);
        if (swimmerTrainings.length > 10) swimmerTrainings.shift();

        res.json({ response, sources });
    } catch (error) {
        console.error("Error in chat:", error);
        res.status(500).json({ error: "Error generating swimmer summary" });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});