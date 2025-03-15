const fs = require('fs');
const puppeteer = require('puppeteer');
const path = require('path');

const CONFIG_FILE = 'config.txt';
const COOKIE_FILE = 'blacklane_cookies.json';
const LOGIN_URL = 'https://partner.blacklane.com/login';
const OFFERS_URL = 'https://partner.blacklane.com/offers';
const EMAIL = 'preetujjwal7@gmail.com';
const PASSWORD = '57e194e96972c01d3134';

let browser, page;

function appendToFile(filePath, data) {
    fs.appendFile(filePath, data + '\n', (err) => {
        if (err) {
            console.error('❌ Error writing to file:', err);
        } else {
            console.log('✅ Data appended successfully!');
        }
    });
}

const loadConfig = () => {
    if (!fs.existsSync(CONFIG_FILE)) {
        console.log("Error: config.txt file is missing.");
        return null;
    }

    const configData = fs.readFileSync(CONFIG_FILE, "utf-8").trim().split("\n");
    if(configData.length<5) return null
    const config = {};

    configData.forEach((line) => {
        let [key, value] = line.split("=");
        if (key && value) {
            config[key.trim().toLowerCase()] = value.trim().toLowerCase();
        }
    });

    return config;
};

const checkOffers = async () => {
    const config = loadConfig(); // Reload config every time

    if (!config || config["enabled"] !== "true") {
        console.log(config)
        console.log("Automation is disabled. Checking again in 10 seconds...");
        return;
    }

    console.log("Checking for offers...");
    const { startTime, endTime, date, service } = config;

    await page.goto(OFFERS_URL, { waitUntil: "networkidle2" });

    try {
        await page.waitForSelector(".Table-module__tableRow--3AB2t", { timeout: 5000 });
        const offers = await page.$$(".Table-module__tableRow--3AB2t");

        if (offers.length > 0) {
            for (const offer of offers) {
                const dateElement = await offer.$(".Date-module__isHighlighted--1ZGgp");
                const dateText = dateElement ? await page.evaluate((el) => el.textContent.trim(), dateElement) : "Unknown";
                const serviceClassElement = await offer.$$(".Table-module__tableCell--3jQ2f");
                const serviceText = serviceClassElement.length > 3 ? await page.evaluate((el) => el.textContent.trim(), serviceClassElement[3]) : "Unknown";
                const timeElement = serviceClassElement.length > 2 ? await page.evaluate((el) => el.textContent.trim(), serviceClassElement[2]) : "Unknown";

                console.log(`Offer Found: ${dateText}, Time: ${timeElement}, Service Class: ${serviceText}`);

                if (dateText === date && timeElement >= startTime && timeElement <= endTime && serviceText.toLowerCase() === service.toLowerCase()) {
                    console.log("✅ Matching Offer Found! Accepting...");
                    const acceptButton = await offer.$("button");
                    if (acceptButton) {
                        await acceptButton.click();
                        const filePath = path.join(__dirname, 'offers.txt');
                        const offerData = "Matching offer accepted at " + new Date().toISOString() + "\n" + offer;                        
                        appendToFile(filePath, offerData);
                        console.log("✅ Offer Accepted Successfully!");
                    } else {
                        console.log("❌ Accept Button Not Found!");
                    }
                    return; // Stop checking once an offer is accepted
                }
            }
        } else {
            console.log("No offers available. Retrying in 10 seconds...");
        }
    } catch (error) {
        console.log("No offers available. Retrying in 10 seconds...");
    }
};

const startAutomation = async () => {
    console.log("🚀 Starting Offer Checker...");

   // browser = await puppeteer.launch({ headless: false });
   browser = await puppeteer.launch({
    headless: "new", // Use new headless mode
    args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu"
    ]
});
    page = await browser.newPage();

    if (fs.existsSync(COOKIE_FILE)) {
        console.log("Loading cookies...");
        const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, "utf-8"));
        await page.setCookie(...cookies);
    }

    await page.goto(LOGIN_URL, { waitUntil: "networkidle2" });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (page.url().includes("offers")) {
        console.log("✅ Logged in using cookies.");
    } else {
        console.log("🔐 Logging in with credentials...");
        await page.type("#email", EMAIL);
        await page.type("#password", PASSWORD);
        await Promise.all([page.click("button[type='submit']"), page.waitForNavigation({ waitUntil: "networkidle2" })]);
        console.log("✅ Login successful. Saving cookies...");
        fs.writeFileSync(COOKIE_FILE, JSON.stringify(await page.cookies(), null, 2));
    }

    setInterval(checkOffers, 10000); // Run checkOffers every 10 seconds
};

startAutomation();
