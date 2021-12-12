const axios = require('axios').default;
const cheerio = require('cheerio');
const fs = require('fs');

let mainJSONObject = {
    month: {},
    days: []
};

// convert to camelCase strings standard
const toCamelCase = (text = "") => {

    for (let i = 0; i < text.length; i++) {

    }
};

// get current month days count
const daysNumberInMonth = (year, month) => new Date(year, month, 0).getDate();

// return numbers of current day, month and year
const todayFullInfoInNum = () => {
    const todayInNumber = new Date().getDate();
    const monthInNumber = new Date().getMonth() + 1;
    const yearInNumber = new Date().getFullYear();

    return {todayInNumber, monthInNumber, yearInNumber};
};

// fetch data from site
const fetchData = () =>
    new Promise(async (resolve, reject) => {
        try {

            const {todayInNumber, monthInNumber, yearInNumber} = todayFullInfoInNum();

            const daysNumInCurrentMonth = daysNumberInMonth(yearInNumber, monthInNumber);

            // implement list of axios request
            const x = [...Array(daysNumInCurrentMonth).keys()]
                .filter(x => ++x <= (daysNumInCurrentMonth - todayInNumber))
                .map(x => axios.get(`https://www.accuweather.com/en/gb/london/ec4a-2/daily-weather-forecast/328328?day=${++x}`));

            // add link of current month to list of links
            x.unshift(axios.get(`https://www.accuweather.com/en/gb/london/ec4a-2/november-weather/328328`));

            console.log("Start Fetching Data From Site \nPlease Wait ... \n");

            const y = await axios.all(x);

            // just list of days info
            const daysInfo = y.filter((x, i) => i !== 0);

            console.clear();

            resolve({monthInfo: y[0], daysInfo});

        } catch (err) {
            reject(err);
        }
    });

// create init JSON object and add monthly info to it
const monthInfoHandler = monthInfo =>
    new Promise((resolve, reject) => {
        try {
            const $ = cheerio.load(monthInfo.data);

            const daysList = $("a.monthly-daypanel");

            let eachDayNum, x, hottest = 0, hottestArr = [], coldest = 0, coldestArr = [], weatherMode = {
                "Clouds giving way to some sun": 0,
                "Low clouds, then some sun": 0,
                "Cloudy": 0,
                "Sunny": 0,
                "Periods of sun with a shower": 0,
                "Times of sun and clouds": 0,
                "Periods of clouds and sun": 0,
                "Some sun": 0,
                "Plenty of sunshine": 0,
                "Sun followed by clouds": 0,
                "Sunshine and patchy clouds": 0,
                "Partly sunny": 0,
                "Variable clouds with a shower": 0,
                "Increasing cloudiness": 0,
                "A little afternoon rain": 0,
                "Windy with periods of rain": 0,
                "A wintry mix in the morning": 0,
                "Periods of rain": 0,
                "Snow showers in the afternoon": 0,
                "Very windy; mostly sunny": 0
            };

            const {todayInNumber, monthInNumber, yearInNumber} = todayFullInfoInNum();

            const daysNumInCurrentMonth = daysNumberInMonth(yearInNumber, monthInNumber);

            daysList
                .filter(id => id >= 1 && id <= daysNumInCurrentMonth)
                .each((id, el) => {
                    eachDayNum = JSON.parse($(el).children("div.monthly-panel-top").children("div.date").text().trim());

                    // find weather modes from current day to last day of current month
                    if (eachDayNum >= todayInNumber && eachDayNum <= daysNumInCurrentMonth) {

                        x = $(el).children("div.monthly-panel-top").children("div.icon-container").children("img").attr("alt").trim();
                        weatherMode[x]++;
                    }

                    // find date of hottest day of current month
                    hottest = JSON.parse($(el).children("div.temp").children("div.high").text().trim().match(/\d+/g).join(""));
                    hottestArr.push(hottest);

                    // find date of coldest day of current month
                    coldest = JSON.parse($(el).children("div.temp").children("div.low").text().trim().match(/\d+/g).join(""));
                    coldestArr.push(coldest);
                });

            // add object of count of weather modes for current month to main JSON object
            mainJSONObject.month["weatherMode"] = weatherMode;

            // add hottest date and temperature to current month in main JSON object
            mainJSONObject.month.hottestTemp = Math.max(...hottestArr);

            // add coldest date and temperature to current month in main JSON object
            mainJSONObject.month.coldestTemp = Math.min(...coldestArr);

            resolve();

        } catch (err) {
            reject(err);
        }
    });

// add available days to main JSON object
const dayInfoHandler = daysInfo =>
    new Promise(async (resolve, reject) => {
        try {

            daysInfo.forEach(({data}) => {
                const $ = cheerio.load(data);

                // get date
                const date = JSON.parse($("div.subnav-pagination").children("div").text().trim().match(/\d+/g).join(""));

                // day information
                const dayObj = {};

                const day = $("div.half-day-card.content-module:first");

                dayObj.dayTemp = JSON.parse(day.children("div.half-day-card-header").children("div.temperature").text().trim().match(/\d+/g));

                dayObj.dayRealFeel = JSON.parse(day.children("div.half-day-card-header").children("div.real-feel").children("div:first").text().trim().match(/\d+/g));

                dayObj.dayPhrase = day.children("div.half-day-card-content").children("div.phrase").text().trim();

                const dayLeftPanelList = day.children("div.half-day-card-content").children("div.panels").children("div.left").children("p.panel-item");

                dayLeftPanelList.each((id, el) => {
                    dayObj[$(el).text().trim()] = $(el).children("span.value").text().trim();
                });

                // night information
                const night = $("div.half-day-card.content-module:eq(1)");

                const nightObj = {};

                nightObj.nightTemp = JSON.parse(night.children("div.half-day-card-header").children("div.temperature").text().trim().match(/\d+/g));

                nightObj.nightRealFeel = JSON.parse(night.children("div.half-day-card-header").children("div.real-feel").children("div:first").text().trim().match(/\d+/g));

                nightObj.nightPhrase = night.children("div.half-day-card-content").children("div.phrase").text().trim();

                const nightLeftPanelList = night.children("div.half-day-card-content").children("div.panels").children("div.left").children("p.panel-item");

                nightLeftPanelList.each((id, el) => {
                    nightObj[$(el).text().trim()] = $(el).children("span.value").text().trim();
                });

                // get sunrise and sunset
                const sunInfo = $("div.sunrise-sunset.card-module.content-module").children("div.content").children("div.panel.left");

                const sunsetAndRiseInfoList = sunInfo.children("div.spaced-content");

                const sunObj = {};

                sunsetAndRiseInfoList.each((id, el) => {
                    if (id !== 0)
                        sunObj[$(el).children("span.text-label").text().trim()] = $(el).children("span.text-value").text().trim();
                });

                mainJSONObject.days.push({date, day: dayObj, night: nightObj, sunInfo: sunObj});
            });

            resolve();

        } catch (err) {
            reject(err);
        }
    });

// save JSON to file
const saveJSONToFile = () => {
    try {

        mainJSONObject = JSON.stringify(mainJSONObject);

        fs.writeFileSync("weatherInfo.json", mainJSONObject);

        console.log("\nSaving JSON File Was Successfully\n");
    } catch (err) {
        console.error(err)
    }
};

const starter = async () => {
    try {

        // fetch all data from site (month and each days data)
        const {monthInfo, daysInfo} = await fetchData();

        // handler for month information
        await monthInfoHandler(monthInfo);

        // handler for each day information
        await dayInfoHandler(daysInfo);

        // save main JSON object to file
        saveJSONToFile()

    } catch (err) {
        console.error(err)
    }
};

starter();