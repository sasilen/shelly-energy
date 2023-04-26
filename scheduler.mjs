// Forked from: https://elspotcontrol.netlify.app/

// Find the time from time period starting here and lasting this many hours
let period_start = 20;
let period_length = 24;

// Request cheapest hours for this length. Set this to typical length needed for f. ex. water heater. 
let needed_length = 4;

// Turn off after this many hours. May be good to keep this longer than needed_length, as
// f. ex. heating water may sometimes take longer
let turn_off_hours = 4;

// If fetching prices fails, use these schedules. Crontab format
let defaultstart = "0 1 2 * * SUN,MON,TUE,WED,THU,FRI,SAT";
let defaultend = "0 1 7 * * SUN,MON,TUE,WED,THU,FRI,SAT";

// Maximum average hourly price. If hourly price is higher than this, do not turn switch on!
// This setting still sets the schedule, but sets switch off both on start and stop. 
// If you want, you can manually then turn the scheduled time on. 
// By default, and if you do not want to uset this, set this very high. 
// The price is EUR per megawatthour, not including taxes! So eg. for a price of 50c/kWH, use 500 
let max_avg_price = 999999;
let keys = ["0.19","0.20","0.21","0.22","0.23","1.0","1.1","1.2","1.3","1.4","1.5","1.6","1.7","1.8","1.9","1.10","1.11","1.12","1.13","1.14","1.15","1.16","1.17","1.18","1.19","1.20"];
let ikeys = [0.19,0.20,0.21,0.22,0.23,1.0,1.01,1.02,1.03,1.04,1.05,1.06,1.07,1.08,1.09,1.10,1.11,1.12,1.13,1.14,1.15,1.16,1.17,1.18,1.19,1.20];
let turn_on_price = 50;

// Crontab for running this script. Good to keep this way
// This means that this script is run at random moment during the first 15 minutes after 18.00
// Random timing is used so that all clients wouldn't be polling the server exactly at same time
let minrand = JSON.stringify(Math.floor(Math.random() * 15));
let secrand = JSON.stringify(Math.floor(Math.random() * 60));
let script_schedule = secrand+" "+minrand+" "+"18 * * SUN,MON,TUE,WED,THU,FRI,SAT";
print("Script schedule:", script_schedule);

// Number for this script. If this doesn't work (as in earlier versions), get it from this url (use your own ip) http://192.168.68.128/rpc/Script.List
let script_number = Shelly.getCurrentScriptId();

// You can check the schedules here (use your own ip) http://192.168.68.128/rpc/Schedule.List

function find_cheapest(result) {
    print("HTTP response is", result);
    if (result === null) {
        updateSchedules(defaultstart, defaultend, true);
    }
    else {
        print("Finding cheapest hours");

        let prices = JSON.parse(result.body);
        let hourly_prices = prices["hourly_prices"];
        
        let cheapest_period_istart = [];
        let cheapest_period_iend = [];
        let cheapest_period_start = {};
        let cheapest_period_end = {};
        
        let cheap_hours_start = [];
        let cheap_hours_end = [];
        let cheap_hours_istart = [];
        let cheap_hours_iend = [];
     
        let cheapest_period_price = {};

        cheapest_period_price = 999999999999;

        let ending = 0;
        let subindex= 0;  

        for (let i=0; i < keys.length; i++) {
                 
            if (hourly_prices[keys[i]]["price"] < turn_on_price && subindex < i) {
//              print("Found cheap hour: ",keys[i]);
              cheap_hours_start.push(keys[i]);
              cheap_hours_istart.push(i);
              for (ending = 0; hourly_prices[keys[i+ending]]["price"] < turn_on_price; ending++) {
                subindex = i + ending;
              }
              print("Found cheap hours: ",keys[i], " -> ", (keys[i + ending]) );
              cheap_hours_end.push(keys[i+ending]);
              cheap_hours_iend.push(i+ending);
            }

            let period_price = 0;

            if (keys.length > needed_length + i) {
              for (let a = 0; a < needed_length; a++) {
                period_price = (period_price + hourly_prices[keys[i+a]]["price"]);
              }
              if (cheapest_period_price > period_price) {
                cheapest_period_price = period_price;
                cheapest_period_start = keys[i];
                cheapest_period_istart = i;
                cheapest_period_end = keys[i+needed_length];
                cheapest_period_iend = i+needed_length;
              }
          }
        }
        print("Cheapest period: ",cheapest_period_start, " -> ", cheapest_period_end);
        let modded=false;
        for (let b=0; b<cheap_hours_start.length; b++) {
          if (ikeys[cheap_hours_istart[b]] <= ikeys[cheapest_period_istart] && ikeys[cheapest_period_istart] <= ikeys[cheap_hours_iend[b]]){
            cheapest_period_istart = cheap_hours_istart[b];
            cheapest_period_start = cheap_hours_start[b];
          }
          if (ikeys[cheap_hours_istart[b]] <= ikeys[cheapest_period_iend] && ikeys[cheapest_period_iend] <= ikeys[cheap_hours_iend[b]]){
            cheapest_period_iend = cheap_hours_iend[b];
            cheapest_period_end = cheap_hours_end[b];
          }
          if (ikeys[cheapest_period_istart] <= ikeys[cheap_hours_istart[b]] && ikeys[cheap_hours_istart[b]] <= ikeys[cheapest_period_iend]){
            cheap_hours_istart[b] = cheapest_period_istart;
            cheap_hours_start[b] = cheapest_period_start;
          }
          if (ikeys[cheapest_period_istart] <= ikeys[cheap_hours_iend[b]] && ikeys[cheap_hours_iend[b]] <= ikeys[cheapest_period_iend]){
            cheap_hours_iend[b] = cheapest_period_iend;
            cheap_hours_end[b] = cheapest_period_end;
          }
        }
        print("-----> MODIFIED OUTPUT <-------");
        let turn_on=true;
        let skip_period=false;
        for (let b=0; b<cheap_hours_start.length; b++) {
           print("Cheap hours: ", cheap_hours_start[b]," -> " cheap_hours_end[b]);
           let timespec = "0 0 " + cheap_hours_start[b].slice(2, cheap_hours_start[b].length) + " * * SUN,MON,TUE,WED,THU,FRI,SAT";
           let offspec = "0 0 " + cheap_hours_end[b].slice(2, cheap_hours_end[b].length) + " * * SUN,MON,TUE,WED,THU,FRI,SAT";
           print(timespec);
           print(offspec);
           Timer.set(Math.floor(Math.random() * 15 * 1000),false,function (ud) { updateSchedules(ud[0],ud[1],ud[2]); },[timespec,offspec,turn_on]);
           if (cheap_hours_start[b]===cheapest_period_start && cheap_hours_end[b]===cheapest_period_end) {
             skip_period=true;
           }
         } 
        if (needed_length!==0 && skip_period===false) {
          print("Cheapest period: ", cheapest_period_start, " -> " cheapest_period_end);
          let timespec = "0 0 " + cheapest_period_start.slice(2, cheapest_period_start.length) + " * * SUN,MON,TUE,WED,THU,FRI,SAT";
          let offspec = "0 0 " + cheapest_period_end.slice(2, cheapest_period_end.length) + " * * SUN,MON,TUE,WED,THU,FRI,SAT";
          print(timespec);
          print(offspec);
          Timer.set(Math.floor(Math.random() * 15 * 1000),false,function (ud) { updateSchedules(ud[0],ud[1],ud[2]); },[timespec,offspec,turn_on]);
        }
    }
}

function updateSchedules(timespec, offspec, turn_on) {

    print(Shelly.call("Schedule.Create", {
        "id": 0, "enable": true, "timespec": timespec,
        "calls": [{
            "method": "Switch.Set",
            "params": {
                id: 0,
                "on": turn_on
            }
        }]
    }
    ));

    print(Shelly.call("Schedule.Create", {
        "id": 0, "enable": true, "timespec": offspec,
        "calls": [{
            "method": "Switch.Set",
            "params": {
                id: 0,
                "on": false
            }
        }]
    } 
    ));
}

function updateTimer() {
    print("Starting, fetching hourly prices");
    print(Shelly.call("Schedule.DeleteAll"));
    // Schedule for the script itself
    print(Shelly.call("Schedule.create", {
        "id": 3, "enable": true, "timespec": script_schedule,
        "calls": [{
            "method": "Script.start",
            "params": {
                "id": script_number
            }
        }]
    }));
    //Stop this script in one minute from now
    Timer.set(60 * 1000, false, function () {
        print("Stopping the script");
        Shelly.call("Script.stop", { "id": script_number })
    });
    Shelly.call("HTTP.GET", { url: "https://elspotcontrol.netlify.app/spotprices-v01-FI.json", timeout:60, ssl_ca:"*"}, find_cheapest);
}

updateTimer();
