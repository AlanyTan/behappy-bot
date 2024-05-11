// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
// <disable>JS1001.SyntaxError</disable>
(function () {
    "use strict";

    // pull in the required packages.
    require('dotenv').config();
    const express = require('express');
    const path = require('path');
    const axios = require('axios');
    const bodyParser = require('body-parser');
    const pino = require('express-pino-logger')();
    const cors = require('cors');
    const public_dir = 'public';
    const system_prompt = require('./system_prompt');

    const app = express();
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(pino);

    // CORS options to allow microsoft resources
    const corsOptions = {
        origin: ['http://localhost:*', 'https://*.windows.net', 'https://*.microsoft.com', 'wss://*.microsoft.com'] // Add other domains as needed
    };
    app.use(cors(corsOptions));
    app.use(express.raw({ type: () => true, limit: '5mb' }));
    app.use(express.static(path.join(__dirname, public_dir)));
    app.use(express.json());

    // serve static root html
    app.get('/', function(req, res) {
        const rootHtml = process.env.ROOT_HTML;
        console.log(`Serving ${rootHtml} from ${__dirname}`);
        res.sendFile(path.join(__dirname, public_dir, rootHtml));
    });

    // Health Check Endpoint
    app.get('/health', (req, res) => {
        res.status(200).send({
            status: 'Healthy',
            timestamp: new Date().toISOString()
        });
    });


    app.get('/api/get-speech-token', async (req, res, next) => {
        res.setHeader('Content-Type', 'application/json');
        const speechKey = process.env.SPEECH_KEY;
        const speechRegion = process.env.SPEECH_REGION;

        if (speechKey === 'paste-your-speech-key-here' || speechRegion === 'paste-your-speech-region-here') {
            res.status(400).send('You forgot to add your speech key or region to the .env file.');
        } else {
            const headers = { 
                headers: {
                    'Ocp-Apim-Subscription-Key': speechKey,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            };

            try {
                const tokenResponse = await axios.post(`https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, null, headers);
                res.send({ token: tokenResponse.data, region: speechRegion });
            } catch (err) {
                res.status(401).send('There was an error authorizing your speech key.');
            }
        }
    });

    app.get('/api/get-tts-relay-token', async (req, res, next) => {
        res.setHeader('Content-Type', 'application/json');
        const speechKey = process.env.SPEECH_KEY;
        const speechRegion = process.env.SPEECH_REGION;

        if (speechKey === 'paste-your-speech-key-here' || speechRegion === 'paste-your-speech-region-here') {
            res.status(400).send('You forgot to add your speech key or region to the .env file.');
        } else {
            const headers = { 
                headers: {
                    'Ocp-Apim-Subscription-Key': speechKey,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            };

            try {
                const tokenResponse = await axios.get(`https://${speechRegion}.tts.speech.microsoft.com/cognitiveservices/avatar/relay/token/v1`, headers);
                res.send({ ...tokenResponse.data, region: speechRegion });
            } catch (err) {
                res.status(401).send('There was an error authorizing your speech key.');
            }
        }
    });

    // Endpoint to chat with OpenAI chat endpoint
    app.post('/api/oaichat', (req, res) => {
        const oaiUrl = process.env.OPENAI_ENDPOINT;
        const oaiKey = process.env.OPENAI_API_KEY;
        const oaiModel = process.env.OPENAI_DEPLOYMENT_NAME;
        const API_URL = `${oaiUrl}/openai/deployments/${oaiModel}/chat/completions?api-version=2023-06-01-preview`

        // Set up the options for the HTTPS request to the other API
        const old_body = JSON.parse(req.body.toString())
        const new_body = {
            messages: [system_prompt,...old_body.messages],
            stream: true
        }

        axios({
            method: 'post',
            url: API_URL,
            headers:{
                'api-key': oaiKey,
                'Content-Type': 'application/json'
            
            },
            data: new_body,
            responseType: 'stream'  // This ensures the response is treated as a stream
        })
        .then(response => {
            // Setting response headers
            res.set(response.headers);
            
            // Status code forwarding
            res.status(response.status);
            
            // Stream the response body directly to the client
            response.data.pipe(res);
        })
        .catch(error => {
            // Error handling
            console.error('Error making API request:', error.message);
            res.status(500).send('Failed to communicate with the API');
        });
    });
    
    // Endpoint to chat with OpenAI assistant endpoint
    app.post('/api/oaiassistant', (req, res) => {
        const oaiUrl = process.env.OPENAI_ENDPOINT;
        const oaiKey = process.env.OPENAI_API_KEY;
        const oaiModel = process.env.OPENAI_DEPLOYMENT_NAME;
        const oaiAssistant = process.env.OPENAI_ASSISTANT_ID||oaiModel;
        let API_URL = ''

        function run_thread(thread_id, message){
            // set message as the newest message to the thread and run it
            API_URL = `${oaiUrl}/openai/threads/${thread_id}/messages?api-version=2024-02-15-preview`
            try {
                axios({
                    method: 'post',
                    url: API_URL,
                    headers:{
                        'api-key': oaiKey,
                        'Content-Type': 'application/json'
                    },
                    data: message
                }).then(response => {
                    let data = response.data
                    API_URL = `${oaiUrl}/openai/threads/${thread_id}/runs?api-version=2024-02-15-preview`
                    axios({
                        method: 'post',
                        url: API_URL,
                        headers:{
                            'api-key': oaiKey,
                            'Content-Type': 'application/json'
                        },
                        data: {'assistant_id': `${oaiAssistant}`, 'stream': true},
                        responseType: 'stream'  // This ensures the response is treated as a stream
                    })
                    .then(response => {
                        // Setting response headers
                        res.set(response.headers);
                        
                        // Status code forwarding
                        res.status(response.status);
                        
                        // Stream the response body directly to the client
                        response.data.pipe(res);
                    })
                    .catch(error => {
                        // Error handling
                        console.error('Error making API request:', error.message);
                        res.status(500).send(`Failed to communicate with the API ${API_URL}`);
                    });
                })
                .catch(error => {
                        // Error handling
                        console.error('Error making API request:', error.message);
                        res.status(500).send(`Failed to communicate with the API ${API_URL}`);
                })
            } catch {
                console.log("run_thread error")
            }
        }

        // Set up the options for the HTTPS request to the other API
        const old_body = JSON.parse(req.body.toString())
        const last_message = old_body.messages[old_body.messages.length - 1]
        let thread_id = old_body.thread_id
        if (!thread_id) {
            //if no thread_id yet, create a new thread
            let API_URL = `${oaiUrl}openai/threads?api-version=2024-02-15-preview`
            axios({
                method: 'post',
                url: API_URL,
                headers:{
                    'api-key': oaiKey,
                    'Content-Type': 'application/json'
                },
                body:{}
            }).then(response =>  {
                let data = response.data
                thread_id = data.id
                run_thread(thread_id, last_message)

            })
        } else {
            run_thread(thread_id, last_message)
        }

    });
    
    // Add this to catch any request not handled by static or other routes
    app.use((req, res, next) => {
        console.log(`User requested unknown resource: ${req.url}`);
        //res.status(404).send('Not found');
        res.redirect('/')
    });

    app.listen(8080, () => {
        console.log('Express server is running on localhost:8080');
    });
}());
// </disable>
