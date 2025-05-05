
import { AzureOpenAIEmbeddings } from "@langchain/openai";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { FaissStore } from "@langchain/community/vectorstores/faiss";

// Your Azure Embedding setup
const embedding = new AzureOpenAIEmbeddings({
temperature:0,
    azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME
});

let vectorStore;

async function loadSwimmerStory() {
    const loader = new TextLoader('./swimmer.txt');
    const data = await loader.load();

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 400,
        chunkOverlap: 40,
    });

    const splitDocs = await splitter.splitDocuments(data);
    console.log("Documents split:", splitDocs.length);

    vectorStore = await FaissStore.fromDocuments(splitDocs, embedding);
    await vectorStore.save('swimmerStoryDb');

    console.log("Vector saved to swimmerStoryDb");
}

await loadSwimmerStory();
