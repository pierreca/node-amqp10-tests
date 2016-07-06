var amqp10 = require('amqp10');
var anHourFromNow = require('azure-iot-common').anHourFromNow;
var SharedAccessSignature = require('azure-iot-device').SharedAccessSignature;

var config = {
  deviceId: '<DEVICE ID>',
  deviceKey: '<DEVICE KEY>',
  host: '<IOTHUB HOST NAME>'
}

setInterval(function() {
  var sas = SharedAccessSignature.create(config.host, config.deviceId, config.deviceKey, anHourFromNow());
  config.sharedAccessSignature = sas.toString();

  var client = new amqp10.Client(amqp10.Policy.merge({
    senderLink: {
      attach: {
        maxMessageSize: 9223372036854775807,
      },
      encoder: function(body) {
        if(typeof body === 'string') {
          return new Buffer(body, 'utf8');
        } else {
          return body;
        }
      },
      reattach: {
        retries: 0,
        forever: false
      }
    },
    // reconnections will be handled at the client level, not the transport level.
    reconnect: {
      retries: 0,
      strategy: 'fibonnaci',
      forever: false
    }
  }, amqp10.Policy.EventHub));

  client.on('client:errorReceived', function (err) {
    debug('Error received from node-amqp10: ' + err.message);
  });

  var iothubUri = 'amqps://' +
                  encodeURIComponent(config.deviceId) +
                  '@sas.' +
                  config.host.split('.')[0] +
                  ':' +
                  encodeURIComponent(config.sharedAccessSignature) +
                  '@' +
                  config.host;;


  var deviceEndpoint = '/devices/' + config.deviceId + '/messages/events';

  console.log('outgoingWindow: ' + amqp10.Policy.EventHub.session.options.outgoingWindow);

  console.log('connecting client');
  client.connect(iothubUri)
        .then(function() {
          console.log('creating sender');
          return client.createSender(deviceEndpoint);
        })
        .then(function(sender) {
          console.log('sending message...');
          return sender.send('foo');
        }).then(function(state) {
          console.log('message sent');
          return client.disconnect();
        }).then(function() {
          console.log('client disconnected');
          client = null;
        }).catch(function(err) {
          console.error('Error: ' + err.message);
        });
}, 2000);