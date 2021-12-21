// Away mode, presence simulation 

// ** Get a random device
// ** Randomly turn it on (if off)
// ** Get a random device
// ** Randomly turn if off (if on, and more than 30 minutes)
// ** Store in device Array (on/off)

// *** start constants block

const modeName = 'away mode';
const minutesOnTreshold = 30;
const minutesOffTreshold = 30;
const changeGatePercentage = 3; // 3 = 30%

// *** end constans block 


// ** start function block
const chanceGate = () => {
  const min = 1;
  const max = 10;
  const rand = Math.floor(Math.random() * (max - min + 1)) + min;
  // % chance of going thru
  if (rand <= changeGatePercentage) {
    return true;
  } else {
    return false;
  }
}

// Check if onoff lastupdated (with onoff state)
const minutesOnOff = (device, onoff) => {
  const deviceOnOff = device.capabilitiesObj.onoff.value
  // log(deviceOnOff + ' : ' + onoff);
  if (deviceOnOff === onoff) {
    const deviceOnDate = device.capabilitiesObj.onoff.lastUpdated;
    const dateDiffMs = Math.abs(new Date(deviceOnDate) - Date.now());
    const minutesDiff = Math.floor((dateDiffMs / 1000) / 60);
    return minutesDiff;
  }

  return 0;
}

const sendNotification = async (message) => {
  // Send a timeline notification
  await Homey.flow.runFlowCardAction({
    uri: 'homey:manager:notifications',
    id: 'create_notification',
    args: {
      text: message
    },
  });
}

const toggleDeviceState = async (device, state) => {
  // Toggle the light state by setting the capability `onoff` to input param
  await device.setCapabilityValue('onoff', state)
    .then(() => {
      activeDevices.push(device.id);
      log(device.name + ' turned ' + state ? 'on' : 'off');
    })
    .catch(error => log(`Error:`, error));
}
// ** end function block


const _value = global.get('presence_active_devices');
let activeDevices = Array.isArray(_value) ? _value : []

// Get all devices
const devices = await Homey.devices.getDevices();

// We do not want to pick lights from garden. Only lights inside the house
const lights = Object.values(devices).filter(device => {
  if (device.zoneName !== 'Garden') {
    if (device.class === 'light' || device.virtualClass === 'light') {
      // console.log(device.name);
      return true;
    }
  }

  return false;
});

// From that indoor lights, we pick the ones that are actually on
const lightsOn = Object.values(lights).filter(device => device.capabilitiesObj.onoff.value);

// From that indoor lights, we pick the ones that are actually off
const lightsOff = Object.values(lights).filter(device => !device.capabilitiesObj.onoff.value);

// ** Pick a random off light device and see if we should turn it on
const offDevice = _.sample(lightsOff);

const offDeviceMinutes = minutesOnOff(offDevice, false);

const messageOff = `[${modeName}] Device ${offDevice.name} has been off for a while (${offDeviceMinutes} m).`
if (offDeviceMinutes > minutesOffTreshold && chanceGate()) {
  log(`${messageOff} Turning on`);
  await toggleDeviceState(offDevice, true);
  activeDevices.push(offDevice.name);
  sendNotification(`${messageOff} Turning on`);
} else {
  log(`${messageOff} But chance saved it for a while`);
}

// ** Pick a random on light device and see if we should turn it off
const onDevice = _.sample(lightsOn);
const onDeviceMinutes = minutesOnOff(onDevice, true);

const messageOn = `[${modeName}] Device ${onDevice.name} has been on for a while (${onDeviceMinutes} m).`
if (onDeviceMinutes > minutesOnTreshold && chanceGate()) {
  log(`${messageOn} Turning off`);
  await toggleDeviceState(onDevice, false);

  activeDevices = activeDevices.filter(device => device !== onDevice.name);

  sendNotification(`${messageOn} Turning off`);
} else {
  log(`${messageOn}  But chance saved it for a while`);
}

// Set the modified active devices to global
global.set('presence_active_devices', activeDevices);
