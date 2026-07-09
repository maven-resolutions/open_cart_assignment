<?php
/**
 * Bridges catalog API controllers to OpenCart admin product writes.
 *
 * Catalog ModelCatalogProduct is read-only; add/edit/delete live in
 * admin/model/catalog/product.php. This wrapper loads the admin model once
 * per request without loading the catalog product model first (same class name).
 */
class ModelApiUnisoukProduct extends Model {
	/** @var ModelCatalogProduct|null */
	private $adminProductModel = null;

	private function getAdminProductModel() {
		if ($this->adminProductModel !== null) {
			return $this->adminProductModel;
		}

		if (class_exists('ModelCatalogProduct', false)) {
			$probe = new ModelCatalogProduct($this->registry);

			if (method_exists($probe, 'addProduct')) {
				$this->adminProductModel = $probe;
				return $this->adminProductModel;
			}

			trigger_error('UniSouk: catalog ModelCatalogProduct is loaded without addProduct(); cannot load admin write model.');
			return null;
		}

		$admin_model_path = DIR_APPLICATION . '../admin/model/catalog/product.php';

		if (!is_file($admin_model_path)) {
			trigger_error('UniSouk: admin product model not found at ' . $admin_model_path);
			return null;
		}

		require_once($admin_model_path);

		$this->adminProductModel = new ModelCatalogProduct($this->registry);

		return $this->adminProductModel;
	}

	public function addProduct($data) {
		$model = $this->getAdminProductModel();

		if (!$model) {
			return 0;
		}

		return (int)$model->addProduct($data);
	}

	public function editProduct($product_id, $data) {
		$model = $this->getAdminProductModel();

		if (!$model) {
			return false;
		}

		$model->editProduct((int)$product_id, $data);

		return true;
	}

	public function deleteProduct($product_id) {
		$model = $this->getAdminProductModel();

		if (!$model) {
			return false;
		}

		$model->deleteProduct((int)$product_id);

		return true;
	}

	public function getProduct($product_id) {
		$model = $this->getAdminProductModel();

		if (!$model) {
			return false;
		}

		return $model->getProduct((int)$product_id);
	}
}
