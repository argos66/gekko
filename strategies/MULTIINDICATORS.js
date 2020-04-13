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

function crossunder(x, y, prev_x, prev_y) {
	if (prev_x > prev_y && y > x) return true; //`x` crossed under `y` otherwise
	return false;
}

function crossover(x, y, prev_x, prev_y) {
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

	var customBBSettings = {
		optInTimePeriod: 20,
		optInNbDevUp: 2,
		optInNbDevDn: 2,
		optInMAType: 2
	}

    this.requiredHistory = this.tradingAdvisor.historySize;
	this.historySize = this.settings.cci.history;

	log.debug('Settings :');
	log.debug('\tsma_fast', this.settings.sma_fast);
	log.debug('\tsma_slow', this.settings.sma_slow);
	log.debug('\tsma_veryslow', this.settings.sma_veryslow);
	log.debug('\ttrailPercentage', this.settings.trailPercentage);
    log.debug('\tcci.threshold_up', this.settings.cci.threshold_up);
    log.debug('\tcci.threshold_down', this.settings.cci.threshold_down);
    log.debug('\tppo.threshold_high', this.settings.ppo.threshold_high);
    log.debug('\tppo.threshold_low', this.settings.ppo.threshold_low);
    log.debug('\tuo.threshold_high', this.settings.uo.threshold_high);
    log.debug('\tuo.threshold_low', this.settings.uo.threshold_low);
    log.debug('\trsi.threshold_high', this.settings.rsi.threshold_high);
    log.debug('\trsi.threshold_low', this.settings.rsi.threshold_low);

	this.addIndicator('sma_fast', 'SMA', this.settings.sma_fast);
	this.addIndicator('sma_slow', 'SMA', this.settings.sma_slow);
	this.addIndicator('sma_veryslow', 'SMA', this.settings.sma_veryslow);
	this.addIndicator('cci', 'CCI', this.settings.cci);
    this.addIndicator('ppo', 'PPO', this.settings.ppo);
    this.addIndicator('rsi', 'RSI', this.settings.rsi);
    this.addIndicator('uo', 'UO', this.settings.uo);
	this.addTalibIndicator('bb', 'bbands', customBBSettings);

	this.nb_macd_buy	= 0;
	this.nb_cci_buy		= 0;
	this.nb_ppo_buy		= 0;
	this.nb_bbrsi_buy	= 0;
	this.nb_rsi_buy		= 0;
	this.nb_uo_buy		= 0;

	this.nb_macd_sell	= 0;
	this.nb_cci_sell	= 0;
	this.nb_ppo_sell	= 0;
	this.nb_bbrsi_sell	= 0;
	this.nb_rsi_sell	= 0;
	this.nb_uo_sell		= 0;

	this.price_buy		= 0;
	this.price_sell		= 0;
	this.nb_trade		= 0;
	this.nb_trade_win	= 0;
	this.nb_trade_lose	= 0;

	this.prev_ppo		= 0;
	this.prev_rsi		= 0;
	this.prev_sma_fast	= 0;
	this.prev_sma_slow	= 0;
	this.prev_sma_veryslow= 0;

	this.prev_candle = {
		open: 0,
		close: 0,
		high: 0,
		low: 0,
		start: ''
	}
}

method.update = function(candle) { // what happens on every new candle?
}

method.log = function() { // for debugging purposes: log the last calculated EMAs and diff.
}

method.check = function(candle) {
    var sma_fast = this.indicators.sma_fast.result;
	var sma_slow = this.indicators.sma_slow.result;
	var sma_veryslow = this.indicators.sma_veryslow.result;
    var cci = this.indicators.cci.result;
    var cci_high = this.settings.cci.threshold_up;
    var cci_low = this.settings.cci.threshold_down;
    var ppo = this.indicators.ppo.result.ppo;
    var ppo_high = this.settings.ppo.threshold_high;
    var ppo_low = this.settings.ppo.threshold_low;
    var uo = this.indicators.uo.uo;
    var uo_high = this.settings.uo.threshold_high;
    var uo_low = this.settings.uo.threshold_low;
    var rsi = this.indicators.rsi.result;
    var rsi_high = this.settings.rsi.threshold_high;
    var rsi_low = this.settings.rsi.threshold_low;
	var bb = this.talibIndicators.bb.result;
    var bull_bear = "";
	var indicator = "";

	var BULL = false;
	var BEAR = false;
	var LONG = false;
	var SHORT= false;

	var BB_high = false;
	var BB_low  = false;

	//Bollinger Band check for going down
	if (this.prev_candle.close > this.prev_candle.open && candle.open > candle.close && this.prev_candle.close > bb['outRealUpperBand'] && candle.close < bb['outRealUpperBand']) { BB_high = true;}
	//Bollinger Band check for going up
	if (this.prev_candle.close < this.prev_candle.open && candle.open < candle.close && this.prev_candle.close < bb['outRealLowerBand'] && candle.close > bb['outRealLowerBand']) { BB_low = true;}

	if (sma_fast > sma_slow) { //On est BULL quand le prix est au dessus du SMA et que ça ce confirme
		BULL = true;
		BEAR = false;
		bull_bear = 'BULL';
	} else if (sma_fast < sma_slow) {
		BULL = false;
		BEAR = true;	
		bull_bear = 'BEAR';		
	}

    //SHORT
	if (this.trend.adviced) {
		if (crossunder(sma_fast, sma_slow, this.prev_sma_fast, this.prev_sma_slow) && (sma_fast - sma_slow) > (candle.close *0.0025)) { //Les 2 MA se croisent et le fast passe dessous
			indicator += "MACD ";
			this.nb_macd_sell++;
			SHORT = true;
		}
		if (BB_high && this.prev_rsi > rsi_high) {
			indicator += "BB/RSI ";
			this.nb_bbrsi_sell++;
			SHORT = true; // RSI au dessus du seuil -> SHORT
		}

		if ((rsi > rsi_high+10 && rsi < this.prev_rsi) || (this.prev_rsi > rsi_high+10 && rsi < rsi_high+10)) {
			indicator += "RSI ";
			this.nb_rsi_sell++;
			SHORT = true; // RSI au dessus du seuil -> SHORT
		}

		if (ppo > ppo_high && this.prev_ppo > ppo) {
			indicator += "PPO ";
			this.nb_ppo_sell++;
			SHORT = true; // PPO au dessus du seuil -> SHORT
		}
/*
		if (BEAR && cci > cci_high) {
			indicator += "CCI ";
			this.nb_cci_sell++;
			SHORT = true;
		}
*/
/*
		if (BEAR && uo > uo_high) {
			indicator += "UO ";
			this.nb_uo_sell++;
			SHORT = true;
		}
*/
	}

    //LONG
	if (!this.trend.adviced) {
		if (crossover(sma_fast, sma_slow, this.prev_sma_fast, this.prev_sma_slow) && (sma_fast - sma_slow) > (candle.close *0.0025)) { //Les 2 MA se croisent et le fast passe dessus
			indicator += "MACD ";
			this.nb_macd_buy++;
			LONG = true;
		}
		if (BB_low && this.prev_rsi < rsi_low) {
			indicator += "BB/RSI ";
			this.nb_bbrsi_buy++;
			LONG = true; // RSI au dessus du seuil -> SHORT
		}

		if ((rsi < rsi_low-10 && rsi > this.prev_rsi) || (this.prev_rsi < rsi_low-10 && rsi > rsi_low-10)) { //RSI trop bas et remonte on achete avant qu'il ne soit trop tard
			indicator += "RSI ";
			this.nb_bbrsi_buy++;
			LONG = true; // le rsi est trop bas -> LONG
		}

		if (ppo < ppo_low && this.prev_ppo > ppo) {
			indicator += "PPO ";
			this.nb_ppo_buy++;
			LONG = true; // PPO courant est en dessous du seuil -> LONG
		}
/*
		if (cci < cci_low) {
			indicator += "CCI ";
			this.nb_cci_buy++;
			LONG = true;
		}
*/
/*
		if (uo < uo_low) {
			indicator += "UO ";
			this.nb_uo_buy++;
			LONG = true;
		}
*/
	}

/*
	if (!this.trend.adviced && BULL && !SHORT && !LONG && sma_fast > (sma_slow *1.2)) {
		this.trailingStop = true;
		this.advice({
		  direction: 'long', // or short
		  trigger: { // ignored when direction is not "long"
			type: 'trailingStop',
			trailPercentage: this.settings.trailPercentage
		  }
		});
	}
*/
	if (LONG && SHORT) {
		if (!this.trend.adviced) log.debug('LONG & SHORT simultané - this.trend.adviced = false');
		if (this.trend.adviced)  log.debug('LONG & SHORT simultané - this.trend.adviced = true');
	}

    if (!this.trend.adviced && LONG && !SHORT) {
		log.debug('LONG', bull_bear, indicator, '*** price:', candle.close, '\t/ sma', sma_veryslow.toFixed(2), '\t/ uo', uo.toFixed(1), '\t/ cci', cci.toFixed(1), '\t/ ppo', ppo.toFixed(1), ' \t/ rsi', rsi.toFixed(1));
		this.price_buy = candle.close;
    	this.trend.adviced = true;
		this.trend.duration = 1;
		this.advice('long');
    } else if (this.trend.adviced && this.trend.duration > 4 && SHORT && !LONG) {
		log.debug('SHORT', bull_bear, indicator, '*** price:', candle.close, '\t/ sma', sma_veryslow.toFixed(2), '\t/ uo', uo.toFixed(1), '\t/ cci', cci.toFixed(1), '\t/ ppo', ppo.toFixed(1), ' \t/ rsi', rsi.toFixed(1), '/ Duration:', this.trend.duration, 'heures');
		if ((this.price_buy - this.price_sell) > 0) this.nb_trade_win++;
		if ((this.price_buy - this.price_sell) < 0) this.nb_trade_lose++;

		this.price_sell = candle.close;
		this.nb_trade++;
		this.trend.adviced = false;
		this.trend.duration = 0;
		this.advice('short');
	} else {
		//log.debug('In no trend');
		if (this.trend.adviced) this.trend.duration++;
		this.advice();
	}

	this.prev_ppo			= ppo;
	this.prev_rsi			= rsi;
	this.prev_sma_fast		= sma_fast;
	this.prev_sma_slow		= sma_slow;
	this.prev_sma_veryslow	= sma_veryslow;

	this.prev_candle.open	= candle.open;
	this.prev_candle.close	= candle.close;
	this.prev_candle.high	= candle.high;
	this.prev_candle.low	= candle.low;
	this.prev_candle.start	= candle.start;
}

method.end = function() { // Execute at the end
	log.debug('');
	log.debug(' Résumé :');
	log.debug(' --------');
	log.debug(' Nombre de trade : \t', this.nb_trade);
	log.debug(' Trade win  : \t\t', this.nb_trade_win);
	log.debug(' Trade lose : \t\t', this.nb_trade_lose);
	log.debug(' % de trades gagnants :\t', ((this.nb_trade_win / this.nb_trade) *100).toFixed(1), '%');
	log.debug(' MACD : \t\t',  (this.nb_macd_buy + this.nb_macd_sell), '\t(buy :', this.nb_macd_buy, '\tsell :', this.nb_macd_sell, ')');
	log.debug(' BB/RSI : \t\t',(this.nb_bbrsi_buy+ this.nb_bbrsi_sell),'\t(buy :', this.nb_bbrsi_buy,'\tsell :', this.nb_bbrsi_sell,')');
	log.debug(' RSI : \t\t\t', (this.nb_rsi_buy  + this.nb_rsi_sell),  '\t(buy :', this.nb_rsi_buy,  '\tsell :', this.nb_rsi_sell,  ')');
	log.debug(' PPO : \t\t\t', (this.nb_ppo_buy  + this.nb_ppo_sell),  '\t(buy :', this.nb_ppo_buy,  '\tsell :', this.nb_ppo_sell,  ')');
	log.debug(' CCI : \t\t\t', (this.nb_cci_buy  + this.nb_cci_sell),  '\t(buy :', this.nb_cci_buy,  '\tsell :', this.nb_cci_sell,  ')');
	log.debug(' UO  : \t\t\t', (this.nb_uo_buy   + this.nb_uo_sell),   '\t(buy :', this.nb_uo_buy,   '\tsell :', this.nb_uo_sell,   ')');
}

module.exports = method;
