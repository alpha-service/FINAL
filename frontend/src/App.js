import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import POSScreen from "@/pages/POSScreen";

function App() {
  return (
    <div className="min-h-screen bg-brand-gray font-body">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<POSScreen />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
