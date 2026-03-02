import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Signals from "./pages/Signals";
import Accuracy from "./pages/Accuracy";
import Sentiment from "./pages/Sentiment";
import OptionsFlow from "./pages/OptionsFlow";
import News from "./pages/News";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="signals" element={<Signals />} />
          <Route path="accuracy" element={<Accuracy />} />
          <Route path="sentiment" element={<Sentiment />} />
          <Route path="options" element={<OptionsFlow />} />
          <Route path="news" element={<News />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
