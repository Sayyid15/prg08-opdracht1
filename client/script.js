// Initialize swimmer and swimmerChatHistory from local storage or as empty arrays
let swimmer = JSON.parse(localStorage.getItem("swimmer")) || [];
let swimmerChatHistory = JSON.parse(localStorage.getItem("swimmerChatHistory")) || [];
let uploadedDocuments = [];

// Function to scroll to the bottom of the chat
function scroll(){
    let textarea = document.getElementById("swimmer-chat");
    textarea.scrollTop = textarea.scrollHeight;
}

// Scroll to the bottom of the chat on page load
window.onload = function(){
    scroll();
}

// Event listeners for UI buttons
const replaceButton = document.querySelector(".delete-button");
const deleteButton = document.querySelector(".delete-list-button");
const deleteSwimmerChat = document.querySelector(".delete-swimmer-chat");

// Event listener for replace button
replaceButton.addEventListener("click", (e) => {
    swimmer.pop();
    swimmerDisplay();
})

// Event listener for delete button
deleteButton.addEventListener("click", (e) => {
    swimmer = [];
    swimmerDisplay();
})

// Event listener for delete chat button
deleteSwimmerChat.addEventListener("click", (e) => {
    swimmerChatHistory = [];
    swimmerChatDisplay();
})

// Function to display swimmer data
function swimmerDisplay() {
    const ul = document.querySelector(".swimmer-content ul");
    ul.innerHTML = '';

    swimmer.forEach((swimmers, index) => {
        const swimmerItem = document.createElement("li");
        swimmerItem.textContent = swimmers;
        ul.appendChild(swimmerItem);

        if (index < swimmer.length - 1) {
            ul.appendChild(document.createElement("br"));
        }
    });
}

// Function to display swimmer chat history
function swimmerChatDisplay(){
    const swimmerChatElement = document.querySelector(".swimmer-chat");
    swimmerChatElement.value = '';

    swimmerChatHistory.forEach((message) => {
        if (message.senderRole === "Swimmer") {
            swimmerChatElement.value += `You 🏊‍♂️: ${message.content}\n`;
        } else {
            swimmerChatElement.value += `SwimCoach AI 🤖: ${message.content}\n`;
        }
    });
}

// Function to handle document upload
async function handleDocumentUpload(event) {
    event.preventDefault();
    const fileInput = document.getElementById("document-upload");
    const loadingIndicator = document.querySelector(".upload-loading");

    if (fileInput.files.length === 0) return;

    loadingIndicator.style.display = "block";

    try {
        const formData = new FormData();
        formData.append("document", fileInput.files[0]);

        const response = await fetch('http://localhost:3000/upload', {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
                `Server error: ${response.status} ${response.statusText}\n` +
                JSON.stringify(errorData, null, 2)
            );
        }

        const result = await response.json();
        uploadedDocuments.push(fileInput.files[0].name);
        updateDocumentList();
        alert(result.message);
    } catch (error) {
        console.error("Error uploading document:", error);
        alert(`Upload failed: ${error.message}`);
    } finally {
        loadingIndicator.style.display = "none";
        fileInput.value = "";
    }
}

// Update document list in UI
function updateDocumentList() {
    const docList = document.querySelector(".document-list");
    docList.innerHTML = "";

    uploadedDocuments.forEach(doc => {
        const docItem = document.createElement("div");
        docItem.className = "document-item";
        docItem.textContent = doc;
        docList.appendChild(docItem);
    });
}

// Function to handle pool form submission
async function handleSubmitPool(event) {
    event.preventDefault();
    try {
        const swimmingPoolInput = document.querySelector(".swimming-pool-input").value;
        const response = await fetch('http://localhost:3000/location', {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({pool: swimmingPoolInput})
        });
        const data = await response.json();
        console.log("Location response:", data);
    } catch(error) {
        console.error("Error getting swimming pool:", error);
    }
}

// Function to handle swimmer form submission
async function handleSubmit(event) {
    event.preventDefault();
    const submitButton = document.querySelector(".submit");
    const loadingSpinner = document.querySelector(".loading-spinner");
    if (submitButton) {
        submitButton.style.display = 'none';
    }
    if (loadingSpinner) {
        loadingSpinner.style.display = "block";
    }

    try {
        const swimmerInput = document.querySelector(".swimmer-input").value;

        const response = await fetch('http://localhost:3000/chat', {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                query: swimmerInput,
                context: swimmerChatHistory.map(msg => msg.content).join("\n")
            })
        });

        const responseData = await response.json();

        swimmerChatHistory.push({content: swimmerInput, senderRole: 'Swimmer'});
        swimmerChatHistory.push({
            content: responseData.response,
            senderRole: 'SwimCoach AI',
            sources: responseData.sources
        });

        swimmer.push(responseData.response);

        if (swimmer.length > 10) {
            swimmer.shift();
        }

        localStorage.setItem("swimmerChatHistory", JSON.stringify(swimmerChatHistory));
        localStorage.setItem("swimmer", JSON.stringify(swimmer));

        swimmerDisplay();
        swimmerChatDisplay();
        scroll();

        // Display sources if available
        if (responseData.sources && responseData.sources.length > 0) {
            displaySources(responseData.sources);
        }
    } catch(error) {
        console.error("Error fetching response:", error);
    } finally {
        if (submitButton) {
            submitButton.style.display = "block";
        }
        if (loadingSpinner) {
            loadingSpinner.style.display = "none";
        }
    }
    document.querySelector(".swimmer-input").value = '';
    document.querySelector(".swimming-pool-input").value = '';
}

// Display sources in UI
function displaySources(sources) {
    const sourcesContainer = document.querySelector(".sources-container");
    sourcesContainer.innerHTML = "<h3>Bronnen:</h3>";

    sources.forEach((source, index) => {
        const sourceElement = document.createElement("div");
        sourceElement.className = "source-item";
        sourceElement.innerHTML = `
            <p><strong>Bron ${index + 1}:</strong></p>
            <p>${source.pageContent.substring(0, 150)}...</p>
        `;
        sourcesContainer.appendChild(sourceElement);
    });
}

// Event listeners
document.querySelector(".swimming-pool-form").addEventListener('submit', handleSubmitPool);
document.querySelector(".swimmer-form").addEventListener('submit', handleSubmit);
document.querySelector(".document-upload-form").addEventListener('submit', handleDocumentUpload);

// Display swimmer data and chat history on page load
swimmerDisplay();
swimmerChatDisplay();