import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
export const Header = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const timeString = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <header className="bg-deepseek-darker border-b border-deepseek-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <img 
              src="/ChatGPT Image Oct 4, 2025, 07_53_38 AM.png" 
              alt="IZIGI ze AFRICA Logo" 
              className="h-16 w-16 object-contain"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">IZIGI ze AFRICA</h1>
            <p className="text-sm text-deepseek-gray-300 flex items-center gap-2">
              <span>AI Development Studio • Created by Vincent Siphamandla Khumalo</span>
              <span className="h-1 w-1 rounded-full bg-deepseek-gray-600" aria-hidden="true"></span>
              <time dateTime={time.toISOString()} className="font-semibold text-deepseek-electric">{timeString}</time>
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-green-400">
            <Activity className="h-4 w-4 animate-pulse" />
            <span className="text-sm font-medium">System Online</span>
          </div>
          <div className="h-6 w-px bg-deepseek-gray-600"></div>
          <div className="text-sm text-deepseek-gray-300">
            Core v1.2.1
          </div>
        </div>
      </div>
    </header>
  );
};
