import { browser, Menus, Runtime, Tabs } from 'webextension-polyfill-ts';
import { getHosts } from './hosts/hosts';
import { Message, MessageAction } from './models/messaging';
import { parsers } from './parsers/parsers';
import { sendToContent } from './utils/messaging';
import { noop } from './utils/noop';

function createMenus(): void {
  browser.contextMenus.create({
    id: 'parse-with',
    title: 'Parse with',
    contexts: ['browser_action'],
  });

  browser.contextMenus.create({
    id: 'problem-parser',
    parentId: 'parse-with',
    title: 'Problem parser',
  });

  browser.contextMenus.create({
    id: 'contest-parser',
    parentId: 'parse-with',
    title: 'Contest parser',
  });

  for (const parser of parsers) {
    const name = parser.constructor.name;
    const isContestParser = name.endsWith('ContestParser');

    browser.contextMenus.create({
      id: `parse-with-${name}`,
      parentId: `${isContestParser ? 'contest' : 'problem'}-parser`,
      title: name,
    });
  }
}

function loadContentScript(tab: Tabs.Tab, parserName: string): void {
  browser.tabs
    .executeScript(tab.id, { file: 'js/content.js' })
    .then(() => {
      sendToContent(tab.id, MessageAction.Parse, { parserName });
    })
    .catch(noop);
}

function onBrowserAction(tab: Tabs.Tab): void {
  loadContentScript(tab, null);
}

function onContextMenu(info: Menus.OnClickData, tab: Tabs.Tab): void {
  if (info.menuItemId.toString().startsWith('parse-with-')) {
    const parserName = info.menuItemId.toString().split('parse-with-').pop();
    loadContentScript(tab, parserName);
  }
}

function send(tabId: number, message: string): void {
  getHosts().then(async hosts => {
    for (const host of hosts) {
      try {
        await host.send(message);
      } catch (err) {
        //
      }
    }

    sendToContent(tabId, MessageAction.TaskSent);
  });
}

function handleMessage(message: Message | any, sender: Runtime.MessageSender): void {
  if (!sender.tab) {
    return;
  }

  if (message.action === MessageAction.SendTask) {
    send(sender.tab.id, message.payload.message);
  }
}

browser.browserAction.onClicked.addListener(onBrowserAction);
browser.contextMenus.onClicked.addListener(onContextMenu);
browser.runtime.onMessage.addListener(handleMessage);

createMenus();
