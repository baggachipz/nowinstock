const puppeteer = require('puppeteer')
const Retailers = Object.assign({}, require('./retailers.json'))

/**
 * Error class used below to capture the partial config if one exists and send it to the catch block
 */
class ConfigError extends Error {
  constructor(config = {}, ...params) {
    super(...params)
    this.name = 'ConfigError'
    this.config = config
  }
}

// load the config and test it. If no config, go through the config create path. Then run the main portion.
try {
  const config = require('./config.json')
  if (!config || !config.phone || !config.twilio || !config.twilio.sid || !config.twilio.token || !config.twilio.number || !config.items || !config.items.length) throw new ConfigError(config)
  main(config)
} catch (e) {
  createConfig(e.config).then((config) => {
    main(config)
  })
}

/**
 * Main application loop. 
 * @param {} config 
 */
async function main(config) {
  const browser = await puppeteer.launch()

  // iterate through the 'items' array in the config
  config.items.forEach(async (item, idx) => {
    try {
      // if the item has already been marked in-stock, don't proceed
      if (!item.inStock) {
        const page = await browser.newPage()

        // set the user-agent string so that certain sites don't block access
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36')
        await page.goto(item.url, {waitUntil: 'networkidle2'})
        
        // assume not in stock until proven otherwise
        let inStock = false
        try {
          // try to select the item on the page (most likely the buy button) that proves item is in stock. Throws exception if not found
          await page.waitForSelector(Retailers[item.type], { visible: true, timeout: 5000 })
          inStock = true
        } catch (e) {
          // do nothing if not found, since inStock is assumed false
        }
        
        if (inStock) {
          // instantiate twilio with the config params and send the message
          const twilio = require('twilio')(config.twilio.sid, config.twilio.token)
          twilio.messages.create({
            body: `${item.name} IN STOCK: ${item.url}`,
            from: config.twilio.number,
            to: config.phone
          })
          console.log(new Date().toString() + ' IN STOCK: ' + item.name)

          // mark it as in stock so as to not trigger another message through twilio
          config.items[idx].inStock = true
        } else {
          console.log(new Date().toString() + ' Out of stock: ' + item.name)
        }
      }
    } catch (e) {
      console.log(new Date().toString() + ' Error checking for ' + item.name)
    }
  })
  
  // recursively call the main loop again after the interval
  setTimeout(() => main(config), config.interval || 120000)
}

async function createConfig(existingConfig) {
  const defaultConfig = require('./config-default.json')
  const config = Object.assign({}, defaultConfig, existingConfig)
  const prompt = require('prompt')
  const fs = require('fs')
  
  const schema = {
    properties: {
      phone: {
        description: 'Phone number to receive text alerts',
        required: true,
        default: config.phone || ''
      },
      sid: {
        description: 'Twilio SID',
        required: true,
        default: config.twilio.sid || ''
      },
      token: {
        description: 'Twilio Token',
        required: true,
        default: config.twilio.token || ''
      },
      number: {
        description: 'Twilio phone number to send from',
        required: true,
        default: config.twilio.number || ''
      }
    }
  }

  if (!config.items || !config.items.length) {
    Object.assign(schema.properties, {
      itemName: {
        description: 'Item name for stock watching',
        required: true,
        default: config.items && config.items[0] && config.items[0].name ? config.items[0].name : '' 
      },
      itemType: {
        type: 'string',
        description: 'Item retailer name [' + Object.keys(Retailers).join(', ') + ']',
        pattern: new RegExp('^(' + Object.keys(Retailers).join('|') + ')$'),
        message: 'Retailer must be one of: ' + Object.keys(Retailers).join(', '),
        required: true,
        before: (v) => v.toLowerCase(),
        default: config.items && config.items[0] && config.items[0].type ? config.items[0].type : '' 
      },
      itemUrl: {
        description: 'Item URL',
        required: true,
        default: config.items && config.items[0] && config.items[0].url ? config.items[0].url : '' 
      } 
    })
  }
  
  prompt.start()

  const { phone, sid, token, number, itemName, itemType, itemUrl } = await prompt.get(schema)

  config.phone = phone
  config.twilio = { sid, token, number }
  if (!config.items || !config.items.length) {
    config.items = []
    config.items.push({
      name: itemName,
      type: itemType,
      url: itemUrl
    })
  }

  fs.writeFileSync('./config.json', JSON.stringify(config))

  return config
}
