const wat_action = require('wat_action_nightmare');
const Nightmare = require('nightmare');

var content = '';
process.stdin.resume();
process.stdin.on('data', function(buf) { 
    content += buf.toString(); 
});
process.stdin.on('end', function() {
    var data = content;
    var obj = JSON.parse(data);
    const scenario = new wat_action.Scenario(obj);
    const browser = new Nightmare({show:false})
    scenario.attachTo(browser).end()
    .then(() => {
        console.log('YEAH!!!');
    })
    .catch((e) => {
        console.log(e);
    })
});
    
