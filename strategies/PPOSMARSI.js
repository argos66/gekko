/*

  PPO + SMA + RSI by ARGOS

*/
var _ = require('lodash');
var log = require('../core/log.js');

var method = {};

function cross(x, y, prev_x, prev_y) { // Return true if two series has crossed each other, otherwise false (x, y correspond to current and prev_x, prev_y correspond to previous value)
	if (prev_x > prev_y && y > x) return true; //`x` crossed under `y` otherwise
	if (prev_y > prev_x && x > y) return true; //`x` crossed over `y` otherwise
	return false;
}

method.init = function() {
	this.name = 'PPO + SMA + RSI by ARGOS';
	this.debug = true; //set to false for production
	this.input = 'candle';
	this.trend = {
		direction: 'none',
		duration: 0,
		persisted: false,
		adviced: false
	};

    this.requiredHistory = this.tradingAdvisor.historySize;

	this.addIndicator('sma', 'SMA', this.settings.sma);
    this.addIndicator('ppo', 'PPO', this.settings.ppo);
    this.addIndicator('rsi', 'RSI', this.settings.rsi);
    this.addIndicator('cci', 'CCI', this.settings.cci);

	this.prev_ppo   = 0;
	this.prev_rsi   = 0;
	this.prev_sma   = 0;
	this.prev_price = 0;
}

method.update = function(candle) { // what happens on every new candle?
}

method.log = function() { // for debugging purposes: log the last calculated EMAs and diff.
}

method.check = function(candle) {
	var price = candle.close;

    var sma = this.indicators.sma.result;
    var ppo = this.indicators.ppo.result.ppo;
    var ppo_high = this.settings.ppo.threshold_high;
    var ppo_low = this.settings.ppo.threshold_low;
    var rsi = this.indicators.rsi.result;
    var rsi_high = this.settings.rsi.threshold_high;
    var rsi_low = this.settings.rsi.threshold_low;
    var cci = this.indicators.cci.result;
    var bull_bear = "";

	var BULL = false;
	var BEAR = false;
	var LONG = false;
	var SHORT= false;

	if (price > sma && this.prev_price > this.prev_sma) { //On est BULL quand le prix est au dessus du SMA et que ça ce confirme
		BULL = true;
		BEAR = false;
		bull_bear = 'BULL';
	} else {
		BULL = false;
		BEAR = true;	
		bull_bear = 'BEAR';		
	}

    //LONG
    if (typeof(cci) == 'number' && cci < -200) 
	if (ppo < ppo_low && this.prev_ppo < ppo_low) LONG = true; // PPO courant et PPO précédent sont en dessous du seuil -> LONG
	if (rsi < rsi_low && BULL) LONG = true; // le rsi est trop bas et on est BULL -> LONG

    //SHORT
	if (ppo > ppo_high) SHORT = true; // PPO au dessus du seuil -> SHORT
    if (rsi > rsi_high) SHORT = true; // RSI au dessus du seuil -> SHORT

    //Trade
	if (!LONG && !SHORT && !this.trend.adviced && BULL && price > (sma * 1.2)) { //Tu faisais rien alors qu'on est en entré en BULL ? et bien vas-y achète
		this.advice({
		  direction: 'long', // or short
		  trigger: { // ignored when direction is not "long"
			type: 'trailingStop',
			trailPercentage: 10
			// or:
			// trailValue: 100
		  }
		});
	}
    if (!this.trend.adviced && LONG) {
		log.debug('LONG', bull_bear, 'price:', candle.close, ' / sma :', sma.toFixed(1), ' / ppo :', ppo.toFixed(1), '(prev:', this.prev_ppo.toFixed(1), ') / rsi :', rsi.toFixed(1), '(prev:', this.prev_rsi.toFixed(1), ')');
    	this.trend.adviced = true;
		this.trend.duration = 1;
    	this.advice('long');
    } else if (this.trend.adviced && SHORT) {
		log.debug('SHORT', bull_bear, 'price:', candle.close, ' / sma :', sma.toFixed(1), ' / ppo :', ppo.toFixed(1), ' / rsi :', rsi.toFixed(1), ' / Duration:', this.trend.duration, 'heures');
		this.trend.adviced = false;
		this.trend.duration = 0;
		this.stop_price = 0;
		this.advice('short');
	} else {
		//log.debug('In no trend');
		if (this.trend.adviced) this.trend.duration++;
		this.advice();
	}

	this.prev_ppo   = ppo;
	this.prev_rsi   = rsi;
	this.prev_sma   = sma;
	this.prev_price = price;
}

module.exports = method;
