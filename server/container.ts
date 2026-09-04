import { ProductRepository, OrderRepository, TenantRepository, FinanceRepository, SystemRepository } from './repositories.ts';

// Global Dependency Injection Container
class Container {
    // The old services will use these new repositories that contain all previous DbService logics
    public productRepository: ProductRepository;
    public orderRepository: OrderRepository;
    public tenantRepository: TenantRepository;
    public financeRepository: FinanceRepository;
    public systemRepository: SystemRepository;

    constructor() {
        // Init Repositories
        this.productRepository = new ProductRepository();
        this.orderRepository = new OrderRepository();
        this.tenantRepository = new TenantRepository();
        this.financeRepository = new FinanceRepository();
        this.systemRepository = new SystemRepository();
    }
}

export const container = new Container();
