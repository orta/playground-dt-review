import type { PlaygroundPlugin, PluginUtils } from "./vendor/playground"
import type { DesignSystem } from "./vendor/ds/createDesignSystem"
import type { PackageInfo, PR, PrInfo, PR_repository_pullRequest } from "./dt-mergebot-types"
import { Sandbox } from "./vendor/sandbox"

const dev = true
const url = dev ? "http://localhost:7071/" : ""
const dtBotInfo = (prNum: number) => fetch(url + "api/Playground-Info?number=" + prNum)

const makePlugin = (utils: PluginUtils) => {
  const customPlugin: PlaygroundPlugin = {
    id: "dt-info",
    displayName: "DT",
    shouldBeSelected: () => window.location.search.includes("dtPR"),
    didMount: async (sandbox, container) => {
      const ds = utils.createDesignSystem(container)
      const params = new URLSearchParams(window.location.search)
      const dtPRNumber = params.get("dtPR") 

      ds.title("DT Pull Request Explorer")
      if (!dtPRNumber) return showEmptyScreen(ds)
    
      const contentDS: DesignSystem = ds.createSubDesignSystem()
      contentDS.subtitle(`Loading PR ${dtPRNumber}`)

      const response = await dtBotInfo(Number(dtPRNumber))
      const json = await response.json() as { state: PrInfo, info:{ data: PR }}
      const pr = json.info.data.repository.pullRequest
      const aPRID = `<a href='https://github.com/DefinitelyTyped/DefinitelyTyped/pull/${dtPRNumber}'>#${dtPRNumber}</a>`
      const author = `<a href='https://github.com/${pr.author.login}'>@${pr.author.login}</a>`
     
      contentDS.clear()
      contentDS.subtitle(`Looking at ${aPRID} ${pr.title} by ${author}`)
      contentDS.p("This plugin injects the changes from a Pull Request to DefinitelyTyped into the Playground's environment. You can then <code>import</code> the new version. It should support any PR which adds or edits existing modules.")

      json.state.pkgInfo.forEach((pkg) => {
        contentDS.subtitle(pkg.name)
        infoForPackage(sandbox, pr, contentDS.createSubDesignSystem())(pkg)
      })
    },
  }

  return customPlugin
}

const infoForPackage  = (sandbox: Sandbox, pr: PR_repository_pullRequest, ds: DesignSystem) => (pkg: PackageInfo) => {
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

            const testFile = `https://rawcdn.githack.com/DefinitelyTyped/DefinitelyTyped/${pr.headRefOid}/${t.path}`
            const res =  await fetch(testFile)
            const text = await res.text()
            sandbox.setText(text)
          }
        })
      }
    }
  }

  refreshUI()

  const root = `https://rawcdn.githack.com/DefinitelyTyped/DefinitelyTyped/${pr.headRefOid}/types/${pkg.name}/index.d.ts`
  const fileMap = {}
  getFile(root)
  return

  async function getFile(file: string) {
    const localName = file.split(`/types/${pkg.name}`)[1]
    const monacoPath = `file:///node_modules/${pkg.name}/${localName}`

    const res =  await fetch(file)
    const text = await res.text()

    const buildInfo = sandbox.ts.preProcessFile(text)
    const filesToLookAt = buildInfo.importedFiles
    downloaded += 1

    fileMap[monacoPath] = text
    sandbox.addLibraryToRuntime(text, monacoPath)

    const filesToDownload = filesToLookAt.filter(f => f.fileName.startsWith("."))
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
  ds.subtitle("Setup issue")
  ds.p("You somehow have lost the param telling this plugin which DT Pull Request number you want to look at. You can set it manually by getting the number, and adding <code>dtPR=112233</code> to the URL of this page, then re-load.")
}

export default makePlugin
