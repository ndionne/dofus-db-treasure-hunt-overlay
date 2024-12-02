import path from 'path'
import { BrowserWindow, app, ipcMain, shell, session} from 'electron'
import { createWindowPositionStore } from './store'

let win: BrowserWindow | null = null
const js = `
  // Hide everything except the element with id 'hunt-solver-tool'
  const hideAllExcept = () => {
    const targetElement = document.querySelector('#hunt-solver-tool');
    if (targetElement) {
      // Hide everything
      document.body.style.visibility = 'hidden';

      // Move the target element to the top of the page
      targetElement.style.position = 'absolute';  // Position it at the top
      targetElement.style.top = '0';  // Align it to the top of the page
      targetElement.style.left = '0'; // Align it to the left of the page
      targetElement.style.width = '100%'; // Make sure it stretches across the screen
      targetElement.style.visibility = 'visible';  // Ensure it's visible

    }
  };
  hideAllExcept();

  const goToWebsite = document.createElement('a')
  const quitButton = document.createElement('button')
  const topLayout = document.createElement('div')

  topLayout.classList.add('dmo-top-layout')
  goToWebsite.classList.add('dmo-go-to-website-btn')
  quitButton.classList.add('dmo-quit-btn')

  quitButton.innerText = 'Quit app'
  quitButton.setAttribute('tab-index', '-1')
  quitButton.addEventListener('click', () => {
    dmo.quit()
  })

  goToWebsite.innerText = 'DOFUS POUR LES NOOBS'
  goToWebsite.setAttribute('tab-index', '-1')
  goToWebsite.addEventListener('click', (evt) => {
    evt.preventDefault()
    dmo.goToWebsite()
  })

  topLayout.appendChild(goToWebsite)
  topLayout.appendChild(quitButton)

  document.body.appendChild(topLayout)

  // Add a header to make the window draggable
  const huntSolverTool = document.getElementById('hunt-solver-tool');
          
  const topLayer = document.createElement('div');
  topLayer.id = 'hunt-solver-tool-header';
  topLayer.style.cssText = 'width: 100%; height: 40px; background-color: transparent; color: white; display: flex; justify-content: center; align-items: center; cursor: move; app-region: drag; z-index: 9999;';
  huntSolverTool.insertBefore(topLayer, huntSolverTool.firstChild);
          
  const contentArea = document.getElementById('hunt-solver-tool-content');
  if (contentArea) {
    contentArea.style.pointerEvents = 'auto';
  }

  // Select the dropdown and the button
  const dropdown = document.getElementById('clue-choice-select');
  const button = document.getElementById('hunt-elt3');

  // Add event listener to dropdown for 'change' event
  dropdown.addEventListener('change', function() {
      const selectedValue = dropdown.value;

      // Check if the selected value is not "0"
      if (selectedValue !== '0') {
          huntClueSearch();
      }
  });


  // Start with the auto copy travel command enabled
  const checkbox = document.getElementById('huntautocopy');
  checkbox.checked = true;
`

const css = `
  .dmo-top-layout {
    position: fixed;
    top: 4px;
    right: 4px;
    display: inline-block;
    align-items: center;
    gap: 4px;
    color: white;
    app-region: no-drag;
    margin-bottom: 100px;
    visibility: visible !important;
  }
  .dmo-quit-btn {
    cursor: pointer;
    border: none;
    background: transparent;
    color: white;
  }

  .dmo-go-to-website-btn {
    cursor: pointer;
    app-region: no-drag;
    color: inherit;
  }

  body {
    background: transparent !important;
    border: 1px var(--q-color-primary) solid !important;
    overflow: hidden !important;
    color: white !important;
    user-select: none !important;
  }
  
  .hunt-solver-tool {
    background: transparent !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  
  .hunt-theme {
    visibility: hidden !important;
  }

  .hunt-clue-result {
    background: transparent !important;
    padding: 0 !important;
    margin-top: 0 !important;
  }
  
  .information-hunt {
    background: transparent !important;
  }

  .hunt-clue-data form > div {
    padding: 0 !important;
  }

  hr.hrhunt {
    visibility: hidden !important;
    margin: 0 !important;
    background-image: none !important;
    height: 0 !important;
  }

  .information-hunt {
    visibility: hidden !important;
  }

  .currentclue {
    color: white !important;
  }

  .hunt-clue-result-direction {
    color: white !important;
    background: transparent !important;
    border-left: none !important;
    box-shadow: none !important;
  }

  .hunt-clue-result-position {
    color: white !important;
    background: transparent !important;
    border-left: none !important;
    box-shadow: none !important;
  }

  .clue-search-result > div {
    margin: 0 !important;
  }

  .clue-search {
    border: none !important;
    margin: 0 !important;
    background: transparent !important;
    color: white !important;
    height: auto !important;
    display: none !important;
  }

  .hunt-tool-lang {
    display: flex !important;
    justify-content: center !important;
    align-items: center !important;
  }

  .hunt-direction-dpln > label {
    margin: 0 15px !important;
    padding: 0 !important;
    height: 33px !important;
    border-radius: 8px !important;
  }

  .clue-seek {
    display: none !important;
  }

  #hunt-result-coord {
    user-select: text !important;
  }
`

function createWindow() {
  const winStore = createWindowPositionStore()

  const { x = 0, y = 90 } = winStore.store
  win = new BrowserWindow({
    width: 290,
    height: 370,
    minWidth: 200,
    minHeight: 100,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'preload.js'),
    },
    hasShadow: false,
    roundedCorners: false,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    acceptFirstMouse: true,
    x,
    y,
    show: false,
  })

  win.on('moved', () => {
    if (!win) return

    const [newX, newY] = win.getPosition()

    winStore.set({ x: newX, y: newY })
  })

  void loadUrl()

  // Intercept and block requests to other domains
  const filter = {
    urls: ['http://*/*', 'https://*/*'] // Matches all URLs
  };

  session.defaultSession.webRequest.onBeforeRequest(filter, (details, callback) => {
    const domainAllowList = ['dofuspourlesnoobs.com', 'editmysite.com'];
    const requestDomain = new URL(details.url).hostname;

    // Block requests to domains other than those in the allow list
    if (!domainAllowList.some(domain => requestDomain.endsWith(domain))) {
      callback({ cancel: true });
    } else {
      callback({ cancel: false });
    }
  });

  win.webContents.on('did-finish-load', async () => {
    try {
      await Promise.all([win?.webContents.insertCSS(css),
        win?.webContents.executeJavaScript(js)]);

      win?.show()
    } catch (err) {
      console.error("Failed during JavaScript execution:", err);
      app.quit()
    }
  })

  win.on('closed', () => {
    win = null
  })

  ipcMain.handle('quit', () => {
    win?.close()
  })

  async function loadUrl() {
    await win?.loadURL(`https://www.dofuspourlesnoobs.com/resolution-de-chasse-aux-tresors.html`, { userAgent: "Chrome" })
  }

  ipcMain.handle('go-to-website', () => {
    void shell.openExternal('https://www.dofuspourlesnoobs.com/')
  })
}

app.on('window-all-closed', () => {
  app.quit()
})

app.on('ready', createWindow)