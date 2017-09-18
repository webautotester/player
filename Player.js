const winston = require('winston');
const Nightmare = require('nightmare');
const amqp = require('amqplib');
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const wat_action = require('wat_action_nightmare');
const QUEUE_NAME = 'wat_queue';

class Player {
	constructor(serverNames) {
		this.dbUrl = `mongodb://${serverNames.mongoServerName}:27017/wat_storage`;
		this.rmqUrl = `amqp://${serverNames.rabbitServerName}`;
		winston.info(`New Player (${this.dbUrl}) (${this.rmqUrl})`);
	}

	start() {
		winston.info('Player Started');
		amqp.connect(this.rmqUrl)
			.then(conn => {
				winston.info('connected');
				this.connection = conn;
				return conn.createConfirmChannel();
			})
			.then(ch => {
				winston.info('channel created');
				this.ch = ch;
				this.ch.assertQueue(QUEUE_NAME, { durable: true });
				winston.info('Queue Created');
				this.ch.prefetch(1);
				this.ch.consume(QUEUE_NAME, scenarioMsg => {
					if (scenarioMsg !== null) {
						playScenario.call(this, scenarioMsg);
					}
				});
			})
			.catch(err => {
				winston.info(err);
				setTimeout(() => {
					this.start(); 
				}, 2000);
			});
	}

}

function playScenario(scenarioMsg) {
	winston.info('Player Begins To Play A Scenario');
	const scenarioContent = JSON.parse(scenarioMsg.content.toString());
	const actions = scenarioContent.actions;
	const scenario = new wat_action.Scenario(actions);
	if (scenarioContent.wait && Number(scenarioContent.wait) !== 0) {
		scenario.addOrUpdateWait(Number(scenarioContent.wait));
		winston.info(`Wait = ${scenarioContent.wait}`);
	} else {
		winston.info('no wait after each action');
	}
	const browser = new Nightmare({show:false, loadTimeout: 2000 , gotoTimeout: 3000});
	scenario.attachTo(browser).end()
		.then(() => {
			winston.info('Scenario Success');
			recordSuccessfulRun.call(this, scenarioMsg);
		})
		.catch((e) => {
			winston.info('Scenario Error');
			recordErrorRun.call(this, scenarioMsg, e);
		});
}

function recordSuccessfulRun(scenarioMsg) {
	winston.info('Record Successful Run');
	var sid = JSON.parse(scenarioMsg.content.toString())._id;
	MongoClient.connect(this.dbUrl)
		.then(db => {
			db.collection('run', (err, runCollection) => {
				if (err) {
					winston.error(err);
				} else {
					var newRun = {};
					newRun.sid = new ObjectID(sid);
					newRun.isSuccess = true;
					newRun.date = new Date().toJSON();//.slice(0,10).replace(/-/g,'/');
					newRun._id = ObjectID();  
					runCollection.save(newRun)
						.then(() => {
							winston.info('Successful Run Has Been Saved');
							this.ch.ack(scenarioMsg);
						}).catch(err => {
							winston.error(err);
						});
				}
			});
		}).catch(err => {
			winston.error(err);
		});
}

function recordErrorRun(scenarioMsg, error) {
	winston.info('Record Error Run');
	var sid = JSON.parse(scenarioMsg.content.toString()).sid;
	MongoClient.connect(this.dbUrl)
		.then(db => {
			db.collection('run', (err, runCollection) => {
				if (err) {
					winston.error(err);
				} else {
					var newRun = {};
					newRun.sid = new ObjectID(sid);
					newRun.isSuccess = false;
					newRun.error = error;
					newRun.date = new Date().toJSON().slice(0,10).replace(/-/g,'/');
					newRun._id = ObjectID();  
					runCollection.save(newRun)
						.then( () => {
							winston.info('Error Run Has Been Saved');
							this.ch.ack(scenarioMsg);
						}).catch(err => {
							winston.error(err);
						});
				}
			});
		}).catch(err => {
			winston.error(err);
		});
}


module.exports.Player = Player;