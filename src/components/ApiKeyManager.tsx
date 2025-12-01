
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Key, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const ApiKeyManager = () => {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isStored, setIsStored] = useState(false);

  useEffect(() => {
    // Check if API key is already stored
    const storedKey = localStorage.getItem("sambanova_api_key");
    if (storedKey) {
      setApiKey(storedKey);
      setIsStored(true);
    }
  }, []);

  const handleSaveKey = () => {
    if (!apiKey.trim()) {
      toast.error("Please enter a valid API key");
      return;
    }
    
    localStorage.setItem("sambanova_api_key", apiKey);
    setIsStored(true);
    toast.success("SambaNova API key saved securely");
  };

  const handleRemoveKey = () => {
    localStorage.removeItem("sambanova_api_key");
    setApiKey("");
    setIsStored(false);
    toast.success("API key removed");
  };

  return (
    <div className="bg-deepseek-gray-800 rounded-lg p-4 border border-deepseek-gray-600">
      <h4 className="text-sm font-medium text-white mb-3 flex items-center">
        <Key className="h-4 w-4 mr-2 text-deepseek-electric" />
        SambaNova API Key
      </h4>
      
      <div className="space-y-3">
        <div className="relative">
          <Input
            type={showKey ? "text" : "password"}
            placeholder="Enter your SambaNova API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="bg-deepseek-gray-700 border-deepseek-gray-600 text-white pr-10"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-deepseek-gray-400 hover:text-white"
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        
        <div className="flex space-x-2">
          <Button
            onClick={handleSaveKey}
            size="sm"
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            <Save className="h-3 w-3 mr-1" />
            Save
          </Button>
          
          {isStored && (
            <Button
              onClick={handleRemoveKey}
              size="sm"
              variant="destructive"
              className="flex-1"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Remove
            </Button>
          )}
        </div>
        
        {isStored && (
          <div className="text-xs text-green-400 flex items-center">
            <div className="h-2 w-2 bg-green-400 rounded-full mr-2"></div>
            API key stored securely in browser
          </div>
        )}
        
        <div className="text-xs text-deepseek-gray-400">
          Your API key is stored locally in your browser and never sent to our servers.
        </div>
      </div>
    </div>
  );
};
