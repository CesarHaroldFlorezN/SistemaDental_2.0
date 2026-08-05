import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'   // <-- ¡ESTA LÍNEA ES LA QUE CARGA TAILWIND CSS!
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)