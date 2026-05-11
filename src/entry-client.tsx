import { StartClient } from '@tanstack/react-start'
import { createRoot } from 'react-dom/client'
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

const root = document.getElementById('app')

if (!root) throw new Error('No root element found')

createRoot(root).render(
  <StartClient
    router={createRouter({
      routeTree,
    })}
  />
)
