// GetTrendStrategy
var _ = require('lodash');
var log = require ('../core/log.js');

var strat = {};

// Prepare everything our method needs
strat.init = function() {
	this.input = 'candle';
	this.currentTrend = 'none';
	this.requiredHistory = this.tradingAdvisor.historySize; // how many candles do we need as a base before we can start giving advice?
	this.previousCandle = { //Initialise previousCandle with 0
		"start": 0,
		"open": 0,
		"close": 0,
		"high": 0,
		"low": 0
	};
	this.debug = true; //set to false for production
}

// What happens on every new candle?
strat.update = function(candle) {
	if (this.debug) {
		log.debug(candle.start, 'candle.open :', candle.open, 'candle.close :', candle.close);
		log.debug(this.previousCandle.start, 'previousCandle.open :', this.previousCandle.open, 'previousCandle.close :', this.previousCandle.close);
		log.debug('----');
	}

	this.previousCandle = candle;
}

// For debugging purposes.
strat.log = function() {

}

// Based on the newly calculated information, check if we should update or not.
strat.check = function(candle) {
	//*** LONG ***//
	if(candle.close > candle.open && (this.currentTrend === 'short' || this.currentTrend === 'none')) {	// If it was short, set it to long
		this.currentTrend = 'long';
		this.advice('long');
	}

	//*** SHORT ***//
	if(candle.close < candle.open && (this.currentTrend === 'long' || this.currentTrend === 'none')) {	// If it was long, set it to short
		this.currentTrend = 'short';
		this.advice('short');
	}
}

// Optional for executing code after completion of a backtest.
// This block will not execute in live use as a live gekko is never ending.
strat.end = function() {

}

module.exports = strat;
