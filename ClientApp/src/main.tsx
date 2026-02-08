import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Auth0Provider } from '@auth0/auth0-react'
import { queryClient } from './lib/queryClient'
import App from './App.tsx'
import './index.css'
import './i18n' // Initialize i18n

const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN || ''
const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID || ''
const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE || ''

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Auth0Provider
      domain={auth0Domain}
      clientId={auth0ClientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: auth0Audience,
        scope: 'openid profile email'
      }}
    >
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </Auth0Provider>
  </React.StrictMode>,
)
