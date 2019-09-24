// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { TimexProperty } = require('@microsoft/recognizers-text-data-types-timex-expression');
const { MessageFactory, InputHints } = require('botbuilder');
const { LuisRecognizer } = require('botbuilder-ai');
const { ComponentDialog, ChoicePrompt, ListStyle, DialogSet, DialogTurnStatus, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');
const helpers = require('./helpers.js')
const MAIN_WATERFALL_DIALOG = 'mainWaterfallDialog';
const CHOICE_PROMPT = 'choicePrompt';

class MainDialog extends ComponentDialog {
    constructor(luisRecognizer, qnaMaker, dbClient, buttonDialog, expectinginputDialog) {
        super('MainDialog');

        if (!luisRecognizer) throw new Error('[MainDialog]: Missing parameter \'luisRecognizer\' is required');
        this.luisRecognizer = luisRecognizer;
        this.qnaMaker = qnaMaker
        this.dbClient = dbClient

        // Define the main dialog and its related components.
        // This is a sample "book a flight" dialog.
        this.addDialog(new TextPrompt('TextPrompt'))
            .addDialog(buttonDialog)
            .addDialog(expectinginputDialog)
            .addDialog(new ChoicePrompt(CHOICE_PROMPT))
            .addDialog(new WaterfallDialog(MAIN_WATERFALL_DIALOG, [
                this.introStep.bind(this),
                this.buttonStep.bind(this),
                this.actStep.bind(this),
                this.finalStep.bind(this)
            ]));

        this.initialDialogId = MAIN_WATERFALL_DIALOG;
    }

    /**
     * The run method handles the incoming activity (in the form of a TurnContext) and passes it through the dialog system.
     * If no dialog is active, it will start the default dialog.
     * @param {*} turnContext
     * @param {*} accessor
     */
    async run(turnContext, accessor) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this);

        const dialogContext = await dialogSet.createContext(turnContext);
        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {
            await dialogContext.beginDialog(this.id);
        }
    }

    /**
     * First step in the waterfall dialog. Prompts the user for a command.
     */
    async introStep(stepContext) {
        if (!this.luisRecognizer.isConfigured) {
            const messageText = 'NOTE: LUIS is not configured. To enable all capabilities, add `LuisAppId`, `LuisAPIKey` and `LuisAPIHostName` to the .env file.';
            await stepContext.context.sendActivity(messageText, null, InputHints.IgnoringInput);
            return await stepContext.next();
        }
        
        if (stepContext.options.buttonNext) {
            return await stepContext.beginDialog('buttonDialog', stepContext.options)
        }
        return await stepContext.next();
    }
    
    async buttonStep(stepContext) {
        var welcomeMessage = "";
        if (stepContext.options.query == null) {
            const querySpec = { query: `SELECT * from c where c.id = 'chat' `}
            const { resources } = await this.dbClient.database(process.env.database).container(process.env.container).items.query(querySpec, {enableCrossPartitionQuery:true}).fetchAll(); 
            stepContext.options.query = resources[0].chatOptions
            welcomeMessage = resources[0].welcomeMessage;
        }
        
        if (stepContext.options.buttonNext) {
            let buttonIntent;
            for (let i of Object.values(stepContext.options.buttonIntents)) {
                if (i.button == stepContext.result.selection) {
                    buttonIntent = i.intent
                    break;
                }
            }
            stepContext.options.myIntent = buttonIntent;
            return await stepContext.next();
        } else {
            const messageText = stepContext.options.nextMessage ? stepContext.options.nextMessage : welcomeMessage;
            const promptMessage = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
            return await stepContext.prompt('TextPrompt', { prompt: promptMessage });
        }
        
    }

    /**
     * Second step in the waterfall.
     */
    async actStep(stepContext) { 
        let messageText = "";
        let luisResult, score, currentIntent;
        let entity = "";
        if (stepContext.options.buttonNext) {
            currentIntent = stepContext.options.myIntent;
            // stepContext.options.buttonNext = false;
        } else {
            luisResult = await this.luisRecognizer.executeLuisQuery(stepContext.context);
            score = luisResult.luisResult.topScoringIntent.score;
            currentIntent = LuisRecognizer.topIntent(luisResult);
            // Check if Entities exist in LUIS Result
            if (luisResult.luisResult.entities[0]) {
                entity = luisResult.luisResult.entities[0].entity; 
            }
        }
         
        const query = stepContext.options.query;
        const previousIntent = stepContext.options.previousIntent;

        currentIntent = helpers.createIntent(query, previousIntent, entity, currentIntent)
        stepContext.options.myIntent = currentIntent;
        // If this is a LUIS intent
        if (query[currentIntent] && query[currentIntent].intents) {
            let key = query[currentIntent].intents[Object.keys(query[currentIntent].intents)[0]];
            if (key.button) {
                stepContext.options.previousIntent = currentIntent
                stepContext.options.buttonIntents = query[currentIntent].intents
                return await stepContext.beginDialog('buttonDialog', stepContext.options);
            } 
            // Luis Intent with no buttons
            else {
                // Attach the message associated with this LUIS intent
                messageText = query[currentIntent].text
            }  
        // Luis Intent with no intent mapping
        } else if (query[currentIntent]) {
            if (query[currentIntent].expectinginput) {
                    return await stepContext.beginDialog('expectinginputDialog', stepContext.options);
            } else {
                // Attach the message associated with this LUIS intent
                messageText = query[currentIntent].text
            }
        }
        
        // Search QNA Maker for response
        else {
            const qnaResults = await this.qnaMaker.getAnswers(stepContext.context);
            if (!qnaResults[0] || qnaResults[0].score < 0.3) {
                // Use Fallback
                stepContext.options.previousIntent = helpers.getFallback(query, stepContext.options.previousIntent)
                stepContext.options.buttonIntents = query[stepContext.options.previousIntent].intents
                return await stepContext.beginDialog('buttonDialog', stepContext.options)
            } else {
                const qna = qnaResults[0].answer;
                messageText = qna;
            } 
        }
        stepContext.options.nextMessage = messageText;
        return await stepContext.next();
    }

    /**
     * This is the final step in the main waterfall dialog.
     */
    async finalStep(stepContext) {
        // Restart the main dialog with a different message the second time around
        stepContext.options.buttonNext = false;
        if (stepContext.result && stepContext.result.selection) {
            let buttonIntent;
            for (let i of Object.values(stepContext.options.buttonIntents)) {
                if (i.button == stepContext.result.selection) {
                    buttonIntent = i.intent
                    break;
                }
            }
            stepContext.options.nextMessage = stepContext.options.query[buttonIntent].text
            stepContext.options.previousIntent = buttonIntent
            if (buttonIntent == "givecontact") {
                stepContext.options.myIntent = buttonIntent
                return await stepContext.beginDialog('expectinginputDialog', stepContext.options);
            }
            if (stepContext.options.query[buttonIntent].intents) {
                let key = stepContext.options.query[buttonIntent].intents[Object.keys(stepContext.options.query[buttonIntent].intents)[0]];
                if (key.button) {
                    stepContext.options.buttonIntents = stepContext.options.query[buttonIntent].intents
                    stepContext.options.buttonNext = true;
                }
            } 
            
        } else if (stepContext.result) {
            stepContext.options.previousIntent = stepContext.options.myIntent;
            stepContext.options.nextMessage = stepContext.result.nextMessage;
            stepContext.options.name = stepContext.result.expectinginput.text1;
            stepContext.options.email = stepContext.result.expectinginput.text2;
        } else {
            stepContext.options.previousIntent = stepContext.options.myIntent;
        }
        return await stepContext.replaceDialog(this.initialDialogId, stepContext.options);
    }
}

module.exports.MainDialog = MainDialog;
