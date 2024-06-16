let swimmer = JSON.parse(localStorage.getItem("swimmer")) || [];
let swimmerChatHistory = JSON.parse(localStorage.getItem("swimmerChatHistory")) || [];

function scroll(){
    let textarea = document.getElementById("swimmer-chat");
    textarea.scrollTop = textarea.scrollHeight;

}

window.onload = function(){
scroll();
}
 //Swimmer UI buttons
const replaceButton= document.querySelector(".delete-button");
const deleteButton= document.querySelector(".delete-list-button");
const deleteSwimmerChat = document.querySelector(".delete-swimmer-chat");

replaceButton.addEventListener("click", (e) => {
    swimmer.pop();
    swimmerDisplay();
})

deleteButton.addEventListener("click", (e) => {
    swimmer= [];
    swimmerDisplay();
})

deleteSwimmerChat.addEventListener("click", (e) => {
    swimmerChatHistory= [];
    swimmerChatDisplay();
})


function swimmerDisplay() {
    const ul = document.querySelector(".swimmer-content ul");
    ul.innerHTML = '';

    swimmer.forEach((swimmers, index)=> {
        const swimmerItem = document.createElement("li");
        swimmerItem.textContent = swimmers;
        ul.appendChild(swimmerItem);


        if (index < swimmer.length - 1) {
            ul.appendChild( document.createElement("br"));
        }
    });
}

function swimmerChatDisplay(){
    const swimmerChatElement = document.querySelector(".swimmer-chat");
    swimmerChatElement.value= '';

    swimmerChatHistory.forEach((message)=> {
    swimmerChatElement.value +=`${message.senderRole} : ${message.content}\n`;
    });
}

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
       console.log("Location response:",data);
    }catch(error) {
        console.error("Error getting swimming pool:", error);
    }
}

async function handleSubmit (event){
    event.preventDefault();
    const submitButton = document.querySelector(".submit");
    const loadingSpinner = document.querySelector(".loading-spinner");
    if (submitButton) {
        submitButton.style.display = 'none';
    }
    if (loadingSpinner) {
        loadingSpinner.style.display = "block";
    }

    try{
        const swimmerInput = document.querySelector(".swimmer-input").value;

        const response = await fetch('http://localhost:3000/chat', {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({query: swimmerInput})
        })

        const responseData = await response.json();

        swimmerChatHistory.push({content: swimmerInput, senderRole:'Swimmer'});
        swimmerChatHistory.push({content: responseData.response, senderRole:'OpenAI API'});
        swimmer.push(responseData.response);

        if (swimmer.length > 10){
            swimmer.shift()
        }

        localStorage.setItem("swimmerChatHistory", JSON.stringify(swimmerChatHistory));
        localStorage.setItem("swimmer", JSON.stringify(swimmer));

        swimmerDisplay();
        swimmerChatDisplay();
        scroll();
    }catch(error){
        console.error("Error fetching response:", error);
    }finally{
        if (submitButton) {
            submitButton.style.display = "block";
        }
        if (loadingSpinner) {
            loadingSpinner.style.display = "none";
        }
    }
    document.querySelector(".swimmer-input").value='';
    document.querySelector(".swimming-pool-input").value='';
}
document.querySelector(".swimming-pool-form").addEventListener('submit', handleSubmitPool);
document.querySelector(".swimmer-form").addEventListener('submit', handleSubmit);
swimmerDisplay()
swimmerChatDisplay()