import type { PlaygroundPlugin, PluginUtils } from "./vendor/playground"
import type { DesignSystem } from "./vendor/ds/createDesignSystem"
import type {  DTBotJSON, PkgInfo } from "./dt-mergebot-types"
import { Sandbox } from "./vendor/sandbox"

const dev = false
const url = dev ? "http://localhost:7071/" : "https://dtmergebot2.azurewebsites.net/"
const dtBotInfo = (prNum: number) => fetch(`${url}api/Playground-Info?number=${prNum}`)

const makePlugin = (utils: PluginUtils) => {
  const customPlugin: PlaygroundPlugin = {
    id: "dt-info",
    displayName: "DT",
    shouldBeSelected: () => window.location.search.includes("dtPR"),
    didMount: async (sandbox, container) => {
      const ds = utils.createDesignSystem(container)
      const params = new URLSearchParams(window.location.search)
      const dtPRNumber = params.get("dtPR") 

      ds.title("DT Pull Request Reviewer")
      if (!dtPRNumber) return showEmptyScreen(ds)
    
      const contentDS: DesignSystem = ds.createSubDesignSystem()
      contentDS.subtitle(`Loading PR ${dtPRNumber}`)

      const response = await dtBotInfo(Number(dtPRNumber))
      const json = await response.json() as DTBotJSON
      console.log(JSON.stringify(json))

      const aPRID = `<a href='https://github.com/DefinitelyTyped/DefinitelyTyped/pull/${dtPRNumber}'>#${dtPRNumber}</a>`
      const author = `<a href='https://github.com/${json.author}'>@${json.author}</a>`
     
      contentDS.clear()
      contentDS.subtitle(`Looking at ${aPRID} ${json.title} by ${author}`)
      contentDS.p("This plugin injects the changes from a Pull Request to DefinitelyTyped into the Playground's environment. You can then <code>import</code> the new version. It should support any PR which adds or edits existing modules.")

      json.pkgInfo.forEach((pkg) => {
        contentDS.subtitle(pkg.name)
        infoForPackage(sandbox, json, contentDS.createSubDesignSystem())(pkg)
      })
    },
  }

  return customPlugin
}

const infoForPackage  = (sandbox: Sandbox, pr: DTBotJSON, ds: DesignSystem) => (pkg: PkgInfo) => {
  let toDownload = 1
  let downloaded = 0

  if (pkg.kind === "delete") {
    return ds.p(`Skipping ${pkg.name} because it was deleted.`)
  }

  const refreshUI = () => {
    ds.clear()
    if (toDownload !== downloaded) {
      ds.p(`Downloading ${downloaded}/${toDownload}`)
    } else {
      ds.p(`Available via <code>import {} from "${pkg.name}"</code> or you can load any of the changed test files.`)

      const tests = pkg.files.filter(f => f.kind === "test")
      if (tests.length) {
        ds.p("Test Files:")
        const ul = document.createElement("ul")
        ds.container.appendChild(ul)

        tests.forEach(t => {
          const li = document.createElement("li")
          const a = document.createElement("a")
          a.href = "#"
          li.appendChild(a)
          ul.appendChild(li)

          a.textContent = t.path.replace(`types/${pkg.name}/`, "")
          a.onclick = async (e) => {
            e.preventDefault()

            const testFile = `https://rawcdn.githack.com/DefinitelyTyped/DefinitelyTyped/${pr.headCommitOid}/${t.path}`
            const res =  await fetch(testFile)
            const text = await res.text()
            sandbox.setText(text)
          }
        })
      }
    }
  }

  refreshUI()

  const root = `https://rawcdn.githack.com/DefinitelyTyped/DefinitelyTyped/${pr.headCommitOid}/types/${pkg.name}/index.d.ts`
  const fileMap = {}
  getFile(root)
  return

  async function getFile(file: string) {
    const toMonacoPath = (name: string) => {
        const localName = name.split(`/types/${pkg.name}`)[1]
        return `/node_modules/${pkg.name}/${localName}`.replace(/\/+/g, "/")
    }

    const monacoPath = toMonacoPath(file)

    const res =  await fetch(file)
    const text = await res.text()

    const buildInfo = sandbox.ts.preProcessFile(text)
    const filesToLookAt = buildInfo.importedFiles
    downloaded += 1

    fileMap[monacoPath] = text
    sandbox.addLibraryToRuntime(text, monacoPath)

    // Ensures we don't keep re-downloading the same files
    const filesToDownload = filesToLookAt.filter(f => {
      const notLocal = f.fileName.startsWith(".") 
      const newURL = new URL(f.fileName, file)
      const address = newURL.toString() + ".d.ts"
      const newMonacoPath = toMonacoPath(address)
      return !fileMap[newMonacoPath] && notLocal
    })

    toDownload += filesToDownload.length
    refreshUI()
    filesToDownload.forEach(f => {
        const newURL = new URL(f.fileName, file)
        const address = newURL.toString() + ".d.ts"
        getFile(address)
    })
  }
}


function showEmptyScreen(ds: DesignSystem) {
  ds.subtitle("Not set up for a PR")
  ds.p("If this is your first time using the DT Review plugin, welcome! This plugin requires a DefinitelyTyped PR number (via <code>?dtPR=12345</code> in the URL) to get started.")
  ds.p("You can either set it up manually in your browser and reload, or go to the <a href='https://github.com/DefinitelyTyped/DefinitelyTyped/pulls'>DefinitelyTyped PRs</a> and find the one you want to review.")
}

export default makePlugin

