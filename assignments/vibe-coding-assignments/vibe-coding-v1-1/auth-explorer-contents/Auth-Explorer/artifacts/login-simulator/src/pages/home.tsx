import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Shield, ShieldAlert, Terminal, AlertTriangle, RefreshCw, Activity, Database, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  useVulnerableLogin,
  useSecureLogin,
  useGetSimulatorUsers,
  useGetSimulatorLogs,
  useResetSimulator,
  getGetSimulatorLogsQueryKey,
  getGetSimulatorUsersQueryKey,
} from "@workspace/api-client-react";
import type { LoginResult } from "@workspace/api-client-react/src/generated/api.schemas";

const ATTACKS = [
  { label: "' OR '1'='1", payload: "' OR '1'='1" },
  { label: "admin'--", payload: "admin'--" },
  { label: "' OR 1=1--", payload: "' OR 1=1--" },
];

function AttackButtons({ onSelect }: { onSelect: (payload: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 mt-4">
      <span className="text-xs text-muted-foreground self-center uppercase font-bold tracking-wider">Try:</span>
      {ATTACKS.map((attack) => (
        <Button
          key={attack.label}
          variant="outline"
          size="sm"
          className="font-mono text-xs py-1 h-7 border-border hover:bg-muted"
          onClick={() => onSelect(attack.payload)}
        >
          {attack.label}
        </Button>
      ))}
    </div>
  );
}

function ResultDisplay({ result, type }: { result: LoginResult | null; type: "vulnerable" | "secure" }) {
  if (!result) return null;

  const isSuccess = result.success;
  const isRateLimited = result.rateLimited;
  const badgeVariant = isSuccess ? (type === "vulnerable" ? "destructive" : "default") : isRateLimited ? "secondary" : "destructive";
  const badgeColor = isSuccess ? (type === "vulnerable" ? "bg-red-600 text-white" : "bg-green-600 text-black") : isRateLimited ? "bg-amber-500 text-black" : "bg-red-900 text-white";

  return (
    <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Execution Result</h4>
        <Badge className={`font-mono font-bold uppercase ${badgeColor}`}>
          {isRateLimited ? "RATE LIMITED" : isSuccess ? "SUCCESS" : "FAILED"}
        </Badge>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">SQL Query Executed:</label>
        <div className="p-3 bg-black border border-border rounded-md font-mono text-sm overflow-x-auto text-green-400 break-all">
          {result.sqlQuery}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">System Response:</label>
        <div className={`p-3 border rounded-md font-mono text-sm leading-relaxed ${isSuccess && type === "vulnerable" ? 'bg-red-950/30 border-red-500/50 text-red-400' : 'bg-muted/50 border-border text-foreground'}`}>
          {result.explanation}
        </div>
      </div>
      
      {result.attackType && (
        <div className="flex items-center gap-2 text-xs font-mono text-amber-500">
          <AlertTriangle className="h-4 w-4" />
          <span>Detected signature: {result.attackType}</span>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const queryClient = useQueryClient();
  const [vulnUsername, setVulnUsername] = useState("");
  const [vulnPassword, setVulnPassword] = useState("");
  const [secureUsername, setSecureUsername] = useState("");
  const [securePassword, setSecurePassword] = useState("");

  const { data: users } = useGetSimulatorUsers();
  const { data: logs } = useGetSimulatorLogs({
    query: {
      refetchInterval: 2000,
      queryKey: getGetSimulatorLogsQueryKey()
    }
  });

  const invalidateData = () => {
    queryClient.invalidateQueries({ queryKey: getGetSimulatorLogsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetSimulatorUsersQueryKey() });
  };

  const vulnLogin = useVulnerableLogin({
    mutation: { onSuccess: invalidateData }
  });

  const secureLogin = useSecureLogin({
    mutation: { onSuccess: invalidateData }
  });

  const resetSim = useResetSimulator({
    mutation: { 
      onSuccess: () => {
        vulnLogin.reset();
        secureLogin.reset();
        invalidateData();
      }
    }
  });

  const handleVulnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    vulnLogin.mutate({ data: { username: vulnUsername, password: vulnPassword } });
  };

  const handleSecureSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    secureLogin.mutate({ data: { username: secureUsername, password: securePassword } });
  };

  return (
    <div className="min-h-screen bg-[#040404] text-foreground font-mono selection:bg-primary selection:text-primary-foreground pb-20">
      <header className="border-b border-border bg-black/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Terminal className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">SECURE_LOGIN_SIMULATOR</h1>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => resetSim.mutate()}
            disabled={resetSim.isPending}
            className="font-mono border-border hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${resetSim.isPending ? 'animate-spin' : ''}`} />
            RESET_ENV
          </Button>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-4 mt-8 space-y-8">
        <div className="p-4 bg-muted/30 border border-border rounded-lg mb-8">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">TARGET OBJECTIVE:</strong> Analyze how authentication systems respond to malicious input.
            The left panel directly interpolates user input into SQL queries. The right panel uses parameterized queries and bcrypt hashing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Vulnerable Panel */}
          <Card className="border-destructive/30 bg-black shadow-lg shadow-destructive/5">
            <CardHeader className="border-b border-border bg-destructive/5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                <CardTitle className="text-destructive font-mono text-lg tracking-wider">VULNERABLE_ENDPOINT</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-mono">Status: Plaintext storage, Direct SQL interpolation</p>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleVulnSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Username</label>
                  <Input 
                    value={vulnUsername}
                    onChange={(e) => setVulnUsername(e.target.value)}
                    className="font-mono bg-black border-border focus-visible:ring-destructive" 
                    placeholder="admin"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Password</label>
                  <Input 
                    value={vulnPassword}
                    onChange={(e) => setVulnPassword(e.target.value)}
                    className="font-mono bg-black border-border focus-visible:ring-destructive"
                    placeholder="password123"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full font-mono font-bold tracking-wider bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={vulnLogin.isPending}
                >
                  {vulnLogin.isPending ? 'EXECUTING...' : 'EXECUTE_PAYLOAD'}
                </Button>
              </form>
              
              <AttackButtons onSelect={(p) => setVulnPassword(p)} />
              
              <ResultDisplay result={vulnLogin.data ?? null} type="vulnerable" />
            </CardContent>
          </Card>

          {/* Secure Panel */}
          <Card className="border-primary/30 bg-black shadow-lg shadow-primary/5">
            <CardHeader className="border-b border-border bg-primary/5">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle className="text-primary font-mono text-lg tracking-wider">SECURE_ENDPOINT</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-mono">Status: Bcrypt hashed, Parameterized queries, Rate limited</p>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSecureSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Username</label>
                  <Input 
                    value={secureUsername}
                    onChange={(e) => setSecureUsername(e.target.value)}
                    className="font-mono bg-black border-border focus-visible:ring-primary" 
                    placeholder="admin"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Password</label>
                  <Input 
                    value={securePassword}
                    onChange={(e) => setSecurePassword(e.target.value)}
                    className="font-mono bg-black border-border focus-visible:ring-primary"
                    placeholder="password123"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full font-mono font-bold tracking-wider bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={secureLogin.isPending}
                >
                  {secureLogin.isPending ? 'AUTHENTICATING...' : 'ATTEMPT_LOGIN'}
                </Button>
              </form>
              
              <AttackButtons onSelect={(p) => setSecurePassword(p)} />

              <ResultDisplay result={secureLogin.data ?? null} type="secure" />
            </CardContent>
          </Card>
        </div>

        {/* System Logs */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-bold tracking-wider">SYSTEM_LOGS</h2>
            <Badge variant="outline" className="ml-auto font-mono text-xs border-border bg-black">LIVE</Badge>
          </div>
          
          <div className="rounded-md border border-border bg-black overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-mono text-xs text-muted-foreground">TIMESTAMP</TableHead>
                  <TableHead className="font-mono text-xs text-muted-foreground">ENDPOINT</TableHead>
                  <TableHead className="font-mono text-xs text-muted-foreground">USERNAME</TableHead>
                  <TableHead className="font-mono text-xs text-muted-foreground">PASSWORD_ATTEMPT</TableHead>
                  <TableHead className="font-mono text-xs text-muted-foreground">RESULT</TableHead>
                  <TableHead className="font-mono text-xs text-muted-foreground">DETECTED_ATTACK</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!logs?.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground font-mono py-8">
                      No events recorded. Waiting for incoming traffic...
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id} className="border-border font-mono text-sm hover:bg-muted/20">
                      <TableCell className="text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </TableCell>
                      <TableCell>
                        <span className={log.endpoint === 'vulnerable' ? 'text-destructive' : 'text-primary'}>
                          {log.endpoint}
                        </span>
                      </TableCell>
                      <TableCell>{log.username}</TableCell>
                      <TableCell className="text-muted-foreground break-all max-w-[200px]">{log.password}</TableCell>
                      <TableCell>
                        {log.success ? (
                          <Badge className={log.endpoint === 'vulnerable' ? 'bg-destructive hover:bg-destructive' : 'bg-primary hover:bg-primary'}>SUCCESS</Badge>
                        ) : log.explanation?.includes('Rate limit') ? (
                          <Badge className="bg-amber-500 hover:bg-amber-600 text-black">RATE_LIMITED</Badge>
                        ) : (
                          <Badge className="bg-muted text-muted-foreground hover:bg-muted border border-border">FAILED</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-amber-500">{log.attackType || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Database State */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Database className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-bold tracking-wider">DATABASE_STATE</h2>
          </div>
          
          <div className="rounded-md border border-border bg-black overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-mono text-xs text-muted-foreground">USERNAME</TableHead>
                  <TableHead className="font-mono text-xs text-muted-foreground w-1/3">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-3 w-3 text-destructive" />
                      VULNERABLE DB (PLAINTEXT)
                    </div>
                  </TableHead>
                  <TableHead className="font-mono text-xs text-muted-foreground w-1/2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-primary" />
                      SECURE DB (BCRYPT)
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id} className="border-border font-mono text-sm hover:bg-muted/20">
                    <TableCell className="font-bold">{user.username}</TableCell>
                    <TableCell className="text-destructive font-mono">{user.passwordPlain}</TableCell>
                    <TableCell className="text-primary font-mono truncate max-w-[300px]" title={user.passwordHash}>
                      {user.passwordHash}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

      </main>
    </div>
  );
}
