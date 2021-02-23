load('api_config.js');
load('api_dash.js');
load('api_events.js');
load('api_gpio.js');
load('api_mqtt.js');
load('api_shadow.js');
load('api_timer.js');
load('api_sys.js');
load('api_net.js');
load('api_config.js');
load('api_uart.js');
load('api_gpio.js');
load('api_esp32.js');
load('api_gps.js');

let led = Cfg.get('board.led1.pin');              // Built-in LED GPIO number
let onhi = Cfg.get('board.led1.active_high');     // LED on when high?
let state = {on: false, uptime: 0};               // Device state
let online = false;                               // Connected to the cloud?
let isConnected = false;
let isGPSLocked = false;
let telemetrySend = false;
let RT = false;
let deviceName = Cfg.get('device.id');
let topic = '/devices/' + deviceName + '/state';
//let stateTopic = '/devices/' + deviceName + '/state';
let configTopic = '/devices/' + deviceName + '/config';
//////////////////////////
let gsmSwitchPin = 23;
let gsmPwrKeyPin = 4;
/////////////////////////////////

GPIO.set_mode(gsmSwitchPin, GPIO.MODE_OUTPUT);
GPIO.set_mode(gsmPwrKeyPin, GPIO.MODE_OUTPUT);
GPIO.write(gsmSwitchPin, 1); // Turn on gsm module
GPIO.write(gsmPwrKeyPin, 1); 

Timer.set(1500, 0, function(){
  // Wait for sometime
}, null);


// Turn Power Key pin low for 1200 ms to turn on the module
Timer.set(1200, 0, function(){
  GPIO.write(gsmPwrKeyPin, 0);
  }, null);
GPIO.write(gsmPwrKeyPin, 1);

function getParsedLatLon() {
  return GPS.getLocation();
}

let setLED = function(on) {
  let level = onhi ? on : !on;
  GPIO.write(led, level);
  print('LED on ->', on);
};


GPIO.set_mode(led, GPIO.MODE_OUTPUT);
setLED(state.on);


let reportState = function() {
  Shadow.update(0, state);
};


let getInfo = function() {
  return JSON.stringify({
    //total_ram: Sys.total_ram() / 1024,
    //free_ram: Sys.free_ram() / 1024,
    //temp: getTemp(),
    latlon: getParsedLatLon()
  });
};
// Update state every second, and report to cloud if online
Timer.set(500, Timer.REPEAT, function() {
  //state.uptime = Sys.uptime();
  //state.ram_free = Sys.free_ram();
  MQTT.sub(
  configTopic,
  function(conn, topic, msg) {
   if(msg === 'ON'){
	   RT = true;
   }else if(msg ==='OFF'){
	   RT =false;
   }
}, null);
  print('online:', online, getInfo(), RT);
  if(RT){
	MQTT.pub(topic, getInfo(),1); 
  }
  if (online) reportState();
}, null);

// Set up Shadow handler to synchronise device state with the shadow state
Shadow.addHandler(function(event, obj) {
  if (event === 'UPDATE_DELTA') {
    print('GOT DELTA:', JSON.stringify(obj));
    for (let key in obj) {  // Iterate over all keys in delta
      if (key === 'on') {   // We know about the 'on' key. Handle it!
        state.on = obj.on;  // Synchronise the state
        setLED(state.on);   // according to the delta
      } else if (key === 'reboot') {
        state.reboot = obj.reboot;      // Reboot button clicked: that
        Timer.set(750, 0, function() {  // incremented 'reboot' counter
          Sys.reboot(500);                 // Sync and schedule a reboot
        }, null);
      }
    }
    reportState();  // Report our new state, hopefully clearing delta
  }
});

Event.on(Event.CLOUD_CONNECTED, function() {
  online = true;
  Shadow.update(0, {ram_total: Sys.total_ram()});
}, null);

Event.on(Event.CLOUD_DISCONNECTED, function() {
  online = false;
}, null);

// Monitor network connectivity.
Net.setStatusEventHandler(function(ev, arg) {
  let evs = '???';
  if (ev === Net.STATUS_DISCONNECTED) {
    evs = 'DISCONNECTED';
  } else if (ev === Net.STATUS_CONNECTING) {
    evs = 'CONNECTING';
  } else if (ev === Net.STATUS_CONNECTED) {
    evs = 'CONNECTED';
  } else if (ev === Net.STATUS_GOT_IP) {
    evs = 'GOT_IP';
  }
  print('== Net event:', ev, evs);
}, null);


function publishData() {
  let msg = getInfo();
  let ok = MQTT.pub(topic, msg,1);
  if (ok) {
    print('Published');
  } else {
    print('Error publishing');
  }
  return ok;
}

// Check if GPS has valid data.
/*gpsTimerId = Timer.set(
  1000,
  true,
  function() {
   let geo = getParsedLatLon();
    if (geo) {
      isGPSLocked = true;
      GPIO.write(gpsStatusPin, 1);
    } else {
      isGPSLocked = false;
      GPIO.write(gpsStatusPin, 0);
    }
  },
  null
);*/

/*MQTT.sub(
  configTopic,
  function(conn, topic, msg) {
  print('Topic:', topic, 'message:', msg);
}, null);*/

MQTT.setEventHandler(function(conn, ev) {
  if (ev === MQTT.EV_CONNACK) {
    print('MQTT CONNECTED');
    isConnected = true;
    GPIO.write(gsmStatusPin, 1);
  }
}, null);

// Checks if is connected to mqtt server and GPS is locked
// Then send data thought mqtt and if it's all ok, go to sleep
Timer.set(
  5000,
  true,
  function() {
    if (true) {
      let ok = publishData();
      telemetrySend = ok;

      if (telemetrySend) {
        goToSleep();
      }
    }
  },
  null
);

/*gpsTimerId = Timer.set(
  1000,
  true,
  function() {
    let geo = getParsedLatLon();
    if (geo) {
      isGPSLocked = true;
      GPIO.write(gpsStatusPin, 1);
    } else {
      isGPSLocked = false;
      GPIO.write(gpsStatusPin, 0);
    }
  },
  null
);*/