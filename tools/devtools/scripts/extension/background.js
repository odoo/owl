import { contentUtils } from '../utils/contentUtils.js';
import { tabUtils } from '../utils/tabUtils.js';

const init = () => {
    console.log('Init background.js');
    openTabAndReadContent();
};

let openTabAndReadContent = async () => {
    const URL = 'https://www.amazon.com/Hasbro-N-A-Connect-Shots/dp/B07BMK2ZJK/ref=sr_1_1?' +
        'm=AGANW9QX5OJOI&marketplaceID=ATVPDKIKX0DER&qid=1575549241&s=merchant-items&sr=1-1';

    try {
        const responseTab = await tabUtils.openLinkInNewTab(URL);

        console.log('responseTab ', responseTab);
        const responseContent = await contentUtils.getContentOfTab(responseTab.id);

        console.log('responseContent ', responseContent);
        await tabUtils.close(responseTab.id);
    } catch (error) {
        console.error('error ', error);
    }
};

window.onload = init;