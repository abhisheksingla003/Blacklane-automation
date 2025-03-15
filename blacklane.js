const fs = require('fs');
const puppeteer = require('puppeteer');

const CONFIG_FILE = 'config.txt';
const COOKIE_FILE = 'blacklane_cookies.json';
const LOGIN_URL = 'https://partner.blacklane.com/login';
const OFFERS_URL = 'https://partner.blacklane.com/offers';
const EMAIL = 'preetujjwal7@gmail.com';
const PASSWORD = '57e194e96972c01d3134';

if (!fs.existsSync(CONFIG_FILE)) {
    console.log('Error: config.txt file is missing.');
    process.exit();
}

const configData = fs.readFileSync(CONFIG_FILE, 'utf-8').trim().split("\n");
const config = {};
configData.forEach(line => {
    let [key, value] = line.split("=");

    if (key && value) {
        config[key.trim().toLowerCase()] = value.trim().toLowerCase();
    }
});

// Check if execution is disabled
if (config['enabled'] !== 'true') {  // Only runs if enabled=true
    console.log('Automation is disabled. Exiting...');
    process.exit();
}

console.log('✅ Automation is enabled. Running script...');

const startTime = config['startTime'] || '';
const endTime = config['endTime'] || '';
const date = config['Date'] || '';
const serviceClass = config['Service'] || '';

console.log('Execution started...');
console.log(`Looking for offers on ${date} between ${startTime} - ${endTime} for Service Class: ${serviceClass}`);

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    if (fs.existsSync(COOKIE_FILE)) {
        console.log('Loading cookies...');
        const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf-8'));
        await page.setCookie(...cookies);
    }

    await page.goto(LOGIN_URL, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (page.url().includes('offers')) {
        console.log('Logged in using cookies.');
    } else {
        console.log('Logging in with credentials...');
        await page.type('#email', EMAIL);
        await page.type('#password', PASSWORD);
        await Promise.all([
            page.click("button[type='submit']"),
            page.waitForNavigation({ waitUntil: 'networkidle2' })
        ]);
        console.log('Login successful. Saving cookies...');
        fs.writeFileSync(COOKIE_FILE, JSON.stringify(await page.cookies(), null, 2));
    }

    async function checkOffers() {
        await page.goto(OFFERS_URL, { waitUntil: 'networkidle2' });
        try {
            await page.waitForSelector('.Table-module__tableRow--3AB2t', { timeout: 5000 });
            const offers = await page.$$('.Table-module__tableRow--3AB2t');
            
            if (offers.length === 0) {
                console.log('No offers available. Retrying in 10 seconds...');
            } else {
                for (const offer of offers) {
                    const dateElement = await offer.$('.Date-module__isHighlighted--1ZGgp');
                    const dateText = dateElement ? await page.evaluate(el => el.textContent.trim(), dateElement) : 'Unknown';
                    const serviceClassElement = await offer.$$('.Table-module__tableCell--3jQ2f');
                    const serviceText = serviceClassElement.length > 3 ? await page.evaluate(el => el.textContent.trim(), serviceClassElement[3]) : 'Unknown';
                    const timeElement = serviceClassElement.length > 2 ? await page.evaluate(el => el.textContent.trim(), serviceClassElement[2]) : 'Unknown';

                    console.log(`Offer Found: ${dateText}, Time: ${timeElement}, Service Class: ${serviceText}`);
                    
                    if (dateText === date && timeElement >= startTime && timeElement <= endTime && serviceText.toLowerCase() === serviceClass.toLowerCase()) {
                        console.log('✅ Matching Offer Found! Accepting...');
                        const acceptButton = await offer.$("button");
                        if (acceptButton) {
                            await acceptButton.click();
                            console.log('✅ Offer Accepted Successfully!');
                        } else {
                            console.log('❌ Accept Button Not Found!');
                        }
                        return; // Stop checking once an offer is accepted
                    }
                }
            }
        } catch (error) {
            console.log('No offers available. Retrying in 10 seconds...');
        }
        setTimeout(checkOffers, 10000); // Retry after 10 seconds
    }
    
    checkOffers(); // Start checking offers
})();
