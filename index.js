const puppeteer = require('puppeteer')
const Retailers = Object.assign({}, require('./retailers.json'))

class ConfigError extends Error {
  constructor(config = {}, ...params) {
    super(...params)
    this.name = 'ConfigError'
    this.config = config
    this.date = new Date()
  }
}

try {
  const config = require('./config.json')
  if (!config || !config.phone || !config.twilio || !config.twilio.sid || !config.twilio.token || !config.twilio.number || !config.items || !config.items.length) throw new ConfigError(config)
  main(config)
} catch (e) {
  createConfig(e.config).then((config) => {
    main(config)
  })
}

async function main(config) {
  const browser = await puppeteer.launch()
  config.items.forEach(async (item, idx) => {
    try {
      if (!item.inStock) {
        const page = await browser.newPage()
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36')
        await page.goto(item.url, {waitUntil: 'networkidle2'})
        let inStock = false
        try {
          await page.waitForSelector(Retailers[item.type], { visible: true, timeout: 5000 })
          inStock = true
        } catch (e) {}
        
        if (inStock) {
          const twilio = require('twilio')(config.twilio.sid, config.twilio.token)
          twilio.messages.create({
            body: `${item.name} IN STOCK: ${item.url}`,
            from: config.twilio.number,
            to: config.phone
          })
          console.log('IN STOCK: ' + item.name)
          config.items[idx].inStock = true
        } else {
          console.log('Out of stock: ' + item.name)
        }
      }
    } catch (e) {
      console.log('Error checking for ' + item.name)
    }
  })
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
