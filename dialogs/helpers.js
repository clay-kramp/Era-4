const { TimexProperty } = require('@microsoft/recognizers-text-data-types-timex-expression');
const { MessageFactory, InputHints } = require('botbuilder');
var EventEmitter = require("events").EventEmitter;
const { LuisRecognizer } = require('botbuilder-ai');
const { ComponentDialog, ChoicePrompt, DialogSet, DialogTurnStatus, TextPrompt, WaterfallDialog, ConfirmPrompt, ListStyle } = require('botbuilder-dialogs');
const { CardFactory } = require('botbuilder');

module.exports = {
	createIntent : 
		function createIntent(query, previousIntent, entity, currentIntent) {
		    // If intent mapping exists
	        if (previousIntent && query[previousIntent] && query[previousIntent].intents) {
	            if (query[previousIntent].intents[currentIntent]) {
	                currentIntent = query[previousIntent].intents[currentIntent]
	            } 
	            // If there is an intent one level deeper
	            else if (query[previousIntent + "-" + currentIntent]) {
	                currentIntent = previousIntent + "-" + currentIntent;
	            } 
	        } 
	        // If there is an entity to be added
	        else if (entity != "") {
	            currentIntent += "-" + entity
	        }
			return currentIntent;
		},
		
		getFallback:
			function getFallback(query, previousIntent) {
                if (query[previousIntent] && query[previousIntent].fallback) {
                    return query[previousIntent].fallback
                } else {
                    let tempIntent = previousIntent;
                    let index = -1;
                    if (tempIntent) {
                        index = tempIntent.lastIndexOf("-");
                    } 
                    while(index != -1) {
                        tempIntent = tempIntent.substr(0, index);
                        if (query[tempIntent].fallback) {
                            return query[tempIntent].fallback;
                            break;
                        }
                        index = tempIntent.lastIndexOf("-");
                    }
                    if (index == -1) {
                        return "fallback";
                    }
			}
        }
}