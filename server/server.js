import {ChatOpenAI} from "@langchain/openai";
import {OpenWeatherAPI} from "openweather-api-node";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

// Initializing express app
const app = express();
const port = 3000

// Middleware for parsing JSON and urlencoded form data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

// Middleware to enable CORS
app.use(cors());

// Initializing ChatOpenAI model
const model = new ChatOpenAI({
    azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
    azureOpenAIApiVersion: process.env.OPENAI_API_VERSION,
    azureOpenAIApiInstanceName: process.env.INSTANCE_NAME,
    azureOpenAIApiDeploymentName: process.env.ENGINE_NAME,
})

// Array to store swimmer trainings
let swimmerTrainings = []

// Variables to store pool name and current weather
let poolName = '';
let currentWeather = '';

// Getting current date
const today = new Date();
const year = today.getFullYear();
let month = today.getMonth() + 1;
let day = today.getDate();

// Formatting day and month
if (day < 10) day = '0' + day;
if (month < 10) month = '0' + month;

// Constructing date string
const date = day + '/' + month + '/' + year;

// Middleware to parse JSON
app.use(express.json());

// Route to welcome users
app.get("/", (req, res) => {
    res.send("Welcome to OpenWeatherAPI server");
})

// Route to set location and get weather
app.post("/location", (req, res) => {
    if (!req.body.pool) {
        return res.status(400).json({error: 'Pool name is required'});
    }

    try {
        poolName = req.body.pool;

        let weather = new OpenWeatherAPI({
            key: process.env.OPENWEATHER_API_KEY, locationName: poolName, units: "imperial"
        })

        weather.getCurrent().then(data => {
            currentWeather = `Current weather in ${poolName} is: ${data.weather.description}`
            console.log(currentWeather);
        })

    } catch (error) {
        console.log("Error getting location", error);
    }
});

// Function to generate swimmer summary
async function swimmerSummary(swimmerTraining) {
    if (!swimmerTraining) {
        throw new Error('Swimmer entry is required');
    }
    let context = ''
    for (let swimmer of swimmerTrainings) {
        context += `${swimmer}`
    }

    let prompt = `Make a summary of the swimmer entry in I person${swimmerTraining}.
    Start of by stating :"${date}:".Make a comment about the weather using the following location: "${currentWeather}".
    The location is: "${poolName}".
    If the entry contains the reference to a previous day use this context: "${context}"`


    const response = await model.invoke(prompt, {
        max_swimmer: 5
    });
    return response.content;
}

// Route to chat with OpenAI
app.post("/chat", async (req, res) => {
    try {
        const swimmerTraining = req.body.query;
        if (!swimmerTraining) {
            return res.status(400).json({error: 'Swimmer entry is required'});
        }
        const response = await swimmerSummary(swimmerTraining);

        swimmerTrainings.push(response)

        if (swimmerTrainings.length > 10) {
            swimmerTrainings.shift()
        }
        res.json({response, senderRole: 'OpenAI API'});
    } catch (error) {
        console.error("Error fetching response", error);
        res.status(500).json({error: "Error fetching response"});
    }
});

// Starting the server
app.listen(port, () => {
    console.log(`Listening on port ${port}`);
})