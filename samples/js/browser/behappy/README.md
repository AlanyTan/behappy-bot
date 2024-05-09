# BeHappy chatbot MVP
This is the MVP of behappy chatbot that can serve chat with the public. 
It currently does not perform authentication, but it uses tokens, and no other credentials are exposed to the client. 

## Tech stack 
This is based on Microsoft's Azure OpenAI API, and MS Speech Cognition API. 
It uses OpenAI to handle chat, and uses MS speech recognition to handle dictation and speech synthesis. 
It also uses MS Avatar to generate animated avatar at the time of speech syntesis as well. 

## How to run
npm install
npm run
Will launch the server side service. 
visit the url: http://localhost:8080/behappy to test it out. 
In a public deployment, replace http://localhost:8080 with the public url. 



## to do 
Adopt OpenAI's assistant API instead of using the /chat API. Following this doc:
https://github.com/Azure/azure-sdk-for-js/blob/main/sdk/openai/openai-assistants/README.md
