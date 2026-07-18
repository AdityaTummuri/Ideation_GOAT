export interface CostReport {
  provider: string;
  estimated_traffic_monthly_requests: number;
  base_cost: number;
  bandwidth_cost: number;
  database_cost: number;
  compute_cost: number;
  total_cost: number;
  free_tier_covered: boolean;
  price_scaling_tier: string;
  detailed_metrics: Record<string, any>;
}

export function forecastDeploymentCosts(provider: string, estimatedTraffic: number): CostReport {
  const providerClean = provider.trim().toLowerCase();

  const report: CostReport = {
    provider,
    estimated_traffic_monthly_requests: estimatedTraffic,
    base_cost: 0.0,
    bandwidth_cost: 0.0,
    database_cost: 0.0,
    compute_cost: 0.0,
    total_cost: 0.0,
    free_tier_covered: false,
    price_scaling_tier: 'Free / Hobby',
    detailed_metrics: {}
  };

  if (providerClean === 'vercel') {
    const millionRequests = estimatedTraffic / 1000000;
    const estimatedBandwidthGb = estimatedTraffic * 0.00015; // Avg 150KB per page/api response

    if (estimatedTraffic <= 100000 && estimatedBandwidthGb <= 100) {
      report.free_tier_covered = true;
      report.total_cost = 0.0;
      report.price_scaling_tier = 'Hobby Tier (Free)';
    } else {
      report.price_scaling_tier = 'Pro Tier';
      report.base_cost = 20.0;

      // Bandwidth: 1TB free on Pro, then $40 per 100GB
      const extraBandwidthGb = Math.max(0.0, estimatedBandwidthGb - 1000);
      report.bandwidth_cost = (extraBandwidthGb / 100.0) * 40.0;

      // Compute: 1M requests included, then $0.60 per million
      const extraRequests = Math.max(0.0, millionRequests - 1);
      report.compute_cost = extraRequests * 0.60;
      report.total_cost = report.base_cost + report.bandwidth_cost + report.compute_cost;
    }

    report.detailed_metrics = {
      estimated_bandwidth_gb: parseFloat(estimatedBandwidthGb.toFixed(2)),
      serverless_executions_millions: parseFloat(millionRequests.toFixed(2))
    };

  } else if (providerClean === 'supabase') {
    const dbStorageGb = estimatedTraffic > 500000 ? 8.0 : 1.0;
    const mau = Math.floor(estimatedTraffic * 0.1); // MAU is approx 10% of total monthly traffic
    const bandwidthGb = estimatedTraffic * 0.00005; // 50KB per request

    if (mau <= 50000 && bandwidthGb <= 2 && dbStorageGb <= 0.5) {
      report.free_tier_covered = true;
      report.total_cost = 0.0;
      report.price_scaling_tier = 'Free Tier';
    } else {
      report.price_scaling_tier = 'Pro Tier';
      report.base_cost = 25.0;

      // Bandwidth overage: Pro includes 250GB, then $0.09/GB
      const extraBandwidth = Math.max(0.0, bandwidthGb - 250);
      report.bandwidth_cost = extraBandwidth * 0.09;

      // DB Storage overage: Pro includes 8GB, then $0.125/GB
      const extraDb = Math.max(0.0, dbStorageGb - 8.0);
      report.database_cost = extraDb * 0.125;

      // MAU overage: Pro includes 100k, then $0.00325 per MAU
      const extraMau = Math.max(0, mau - 100000);
      report.compute_cost = extraMau * 0.00325;

      report.total_cost = report.base_cost + report.bandwidth_cost + report.database_cost + report.compute_cost;
    }

    report.detailed_metrics = {
      estimated_bandwidth_gb: parseFloat(bandwidthGb.toFixed(2)),
      estimated_db_storage_gb: parseFloat(dbStorageGb.toFixed(2)),
      estimated_monthly_active_users: mau
    };

  } else if (providerClean === 'neon') {
    const computeHours = estimatedTraffic * 0.001; // Estimating 1 hour per 1000 requests due to auto-suspend
    const dbStorageGb = estimatedTraffic <= 100000 ? 5.0 : 25.0;

    if (dbStorageGb <= 0.5 && computeHours <= 100) {
      report.free_tier_covered = true;
      report.total_cost = 0.0;
      report.price_scaling_tier = 'Free Tier';
    } else if (dbStorageGb <= 10.0 && computeHours <= 300) {
      report.price_scaling_tier = 'Launch Plan';
      report.base_cost = 19.0;
      report.total_cost = 19.0;
    } else {
      report.price_scaling_tier = 'Scale Plan';
      report.base_cost = 69.0;
      const extraDb = Math.max(0.0, dbStorageGb - 40.0);
      report.database_cost = extraDb * 0.12; // $0.12 per GB over 40GB
      const extraCompute = Math.max(0.0, computeHours - 750);
      report.compute_cost = extraCompute * 0.10; // $0.10 per compute hour over 750
      report.total_cost = report.base_cost + report.database_cost + report.compute_cost;
    }

    report.detailed_metrics = {
      estimated_db_storage_gb: dbStorageGb,
      estimated_compute_hours: parseFloat(computeHours.toFixed(1))
    };

  } else if (providerClean === 'aws') {
    const millionRequests = estimatedTraffic / 1000000;
    const bandwidthGb = estimatedTraffic * 0.0001; // 100KB per response

    report.price_scaling_tier = 'AWS Pay-as-you-go';
    report.base_cost = 0.0;
    report.bandwidth_cost = bandwidthGb * 0.08;

    // API Gateway cost
    const apigwCost = millionRequests * 3.50;
    // Lambda cost
    const lambdaExecCost = millionRequests * 0.20;
    const lambdaComputeCost = millionRequests * 1000000 * 0.025 * 0.0000166667;

    report.compute_cost = apigwCost + lambdaExecCost + lambdaComputeCost;

    // DynamoDB cost
    const dbStorageGb = estimatedTraffic <= 100000 ? 5.0 : 50.0;
    report.database_cost = dbStorageGb * 0.25;

    // Deduct AWS Free Tier limits if traffic is very small (1M lambda requests, 1M API gateway calls, etc.)
    if (estimatedTraffic <= 1000000) {
      // Free tier covers lambda & dynamo base storage
      report.database_cost = Math.max(0.0, report.database_cost - 6.25); // 25GB free
      report.compute_cost = Math.max(0.0, report.compute_cost - 1.0);
    }

    report.total_cost = report.base_cost + report.bandwidth_cost + report.database_cost + report.compute_cost;
    report.detailed_metrics = {
      api_gateway_cost: parseFloat(apigwCost.toFixed(2)),
      lambda_cost: parseFloat((lambdaExecCost + lambdaComputeCost).toFixed(2)),
      cloudfront_bandwidth_gb: parseFloat(bandwidthGb.toFixed(2))
    };

  } else {
    // Generic VM backup
    report.price_scaling_tier = 'Standard VM Hosting (Estimate)';
    report.base_cost = 15.0; // basic VPS cost
    const bandwidthGb = estimatedTraffic * 0.0001;
    report.bandwidth_cost = Math.max(0.0, bandwidthGb - 1000) * 0.01; // $0.01 per GB over 1TB
    report.total_cost = report.base_cost + report.bandwidth_cost;
  }

  // Standardize values
  report.base_cost = parseFloat(report.base_cost.toFixed(2));
  report.bandwidth_cost = parseFloat(report.bandwidth_cost.toFixed(2));
  report.database_cost = parseFloat(report.database_cost.toFixed(2));
  report.compute_cost = parseFloat(report.compute_cost.toFixed(2));
  report.total_cost = parseFloat(report.total_cost.toFixed(2));

  return report;
}
